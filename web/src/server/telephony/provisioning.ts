import type { BusinessRepository } from "@/server/business/bootstrap";
import { getAppConfig, type AppConfig } from "@/server/config";
import type { BusinessRow } from "@/server/db/schema";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { normalizePhoneNumber } from "@/server/phone/normalize";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
const TRIAL_DAYS = 14;
const VOICE_WEBHOOK_PATH = "/api/webhooks/twilio/voice";
const SMS_WEBHOOK_PATH = "/api/webhooks/twilio/sms";

export type ProvisionNumberOptions = {
  areaCode?: string | null;
};

export type ProvisionNumberDependencies = {
  businessRepository: BusinessRepository;
  auditEventRepository?: AuditEventRepository;
  config?: AppConfig;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: Date;
};

export type ProvisionNumberResult = {
  business: BusinessRow;
  phoneNumber: string;
  phoneNumberSid: string;
  status: "simulated" | "provisioned" | "already_provisioned";
  networkCallsMade: boolean;
  voiceUrl: string | null;
  smsUrl: string | null;
};

type TwilioAvailableNumber = {
  phone_number?: string;
  phoneNumber?: string;
};

type TwilioAvailableNumbersResponse = {
  available_phone_numbers?: TwilioAvailableNumber[];
};

type TwilioIncomingPhoneNumberResponse = {
  sid?: string;
  phone_number?: string;
};

export async function activateBusinessNumber(
  businessId: string,
  options: ProvisionNumberOptions = {},
  dependencies?: ProvisionNumberDependencies
): Promise<ProvisionNumberResult> {
  return provisionNumberForBusiness(businessId, options, dependencies);
}

export async function provisionNumberForBusiness(
  businessId: string,
  options: ProvisionNumberOptions = {},
  dependencies?: ProvisionNumberDependencies
): Promise<ProvisionNumberResult> {
  const deps = dependencies ?? (await defaultDependencies());
  const config = deps.config ?? getAppConfig();
  const env = deps.env ?? process.env;
  const business = await deps.businessRepository.findById(businessId);

  if (!business) {
    throw new Error(`Business ${businessId} was not found.`);
  }

  if (business.twilio_number_e164 && business.twilio_number_sid) {
    return {
      business,
      phoneNumber: business.twilio_number_e164,
      phoneNumberSid: business.twilio_number_sid,
      status: "already_provisioned",
      networkCallsMade: false,
      voiceUrl: null,
      smsUrl: null
    };
  }

  if (shouldSimulateProvisioning(config)) {
    return provisionSandboxNumber(deps, business, deps.now ?? new Date());
  }

  assertRealProvisioningConfigured(config, env);

  const voiceUrl = webhookUrl(config.publicBaseUrl, VOICE_WEBHOOK_PATH);
  const smsUrl = webhookUrl(config.publicBaseUrl, SMS_WEBHOOK_PATH);
  const accountSid = env.TWILIO_ACCOUNT_SID as string;
  const authToken = env.TWILIO_AUTH_TOKEN as string;
  const availableNumber = await findAvailableTwilioNumber({
    accountSid,
    authToken,
    areaCode: options.areaCode ?? config.twilioDefaultAreaCode,
    fetchImpl: deps.fetchImpl ?? fetch
  });
  const purchased = await buyTwilioNumber({
    accountSid,
    authToken,
    phoneNumber: availableNumber,
    voiceUrl,
    smsUrl,
    fetchImpl: deps.fetchImpl ?? fetch
  });
  const trialEndsAt = addDays(deps.now ?? new Date(), TRIAL_DAYS).toISOString();
  const updatedBusiness = await deps.businessRepository.updateTelephony(business.id, {
    twilioNumber: purchased.phoneNumber,
    twilioNumberSid: purchased.phoneNumberSid,
    numberStatus: "trial",
    numberTrialEndsAt: trialEndsAt
  });

  await deps.auditEventRepository?.create({
    business_id: business.id,
    customer_profile_id: null,
    actor: "system",
    event_type: "number.trial_provisioned",
    event_json: {
      phoneNumber: purchased.phoneNumber,
      phoneNumberSid: purchased.phoneNumberSid,
      trialEndsAt,
      voiceUrl,
      smsUrl
    }
  });

  return {
    business: updatedBusiness,
    phoneNumber: purchased.phoneNumber,
    phoneNumberSid: purchased.phoneNumberSid,
    status: "provisioned",
    networkCallsMade: true,
    voiceUrl,
    smsUrl
  };
}

async function defaultDependencies(): Promise<ProvisionNumberDependencies> {
  const rt = await getIntakeRuntime();
  return {
    businessRepository: rt.businessRepository,
    auditEventRepository: rt.auditEventRepository
  };
}

function shouldSimulateProvisioning(config: AppConfig): boolean {
  return !config.twilioAutoProvision || config.sandboxMode || config.persistence === "memory";
}

function assertRealProvisioningConfigured(config: AppConfig, env: NodeJS.ProcessEnv): void {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio number provisioning requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }

  if (!config.publicBaseUrl) {
    throw new Error("Twilio number provisioning requires PUBLIC_BASE_URL for webhook URLs.");
  }
}

function webhookUrl(publicBaseUrl: string | null, path: string): string {
  if (!publicBaseUrl) {
    throw new Error("PUBLIC_BASE_URL is required to build Twilio webhook URLs.");
  }

  return new URL(path, publicBaseUrl).toString();
}

async function provisionSandboxNumber(
  deps: ProvisionNumberDependencies,
  business: BusinessRow,
  now: Date
): Promise<ProvisionNumberResult> {
  const phoneNumber = sandboxNumberForBusiness(business.id);
  const phoneNumberSid = `PN_SANDBOX_${business.id.replaceAll("-", "").slice(0, 12)}`;
  const trialEndsAt = addDays(now, TRIAL_DAYS).toISOString();
  const updatedBusiness = await deps.businessRepository.updateTelephony(business.id, {
    twilioNumber: phoneNumber,
    twilioNumberSid: phoneNumberSid,
    numberStatus: "trial",
    numberTrialEndsAt: trialEndsAt
  });

  await deps.auditEventRepository?.create({
    business_id: business.id,
    customer_profile_id: null,
    actor: "system",
    event_type: "number.trial_provisioned.simulated",
    event_json: {
      phoneNumber,
      phoneNumberSid,
      trialEndsAt
    }
  });

  return {
    business: updatedBusiness,
    phoneNumber,
    phoneNumberSid,
    status: "simulated",
    networkCallsMade: false,
    voiceUrl: null,
    smsUrl: null
  };
}

function sandboxNumberForBusiness(businessId: string): string {
  const digits = businessId.replace(/\D/g, "") || "1";
  const suffix = digits.padEnd(4, "0").slice(0, 4);
  return normalizePhoneNumber(`+1650555${suffix}`);
}

async function findAvailableTwilioNumber(input: {
  accountSid: string;
  authToken: string;
  areaCode?: string | null;
  fetchImpl: typeof fetch;
}): Promise<string> {
  const url = new URL(
    `${TWILIO_API_BASE}/Accounts/${input.accountSid}/AvailablePhoneNumbers/US/Local.json`
  );
  url.searchParams.set("VoiceEnabled", "true");
  url.searchParams.set("SmsEnabled", "true");
  url.searchParams.set("PageSize", "1");
  if (input.areaCode?.trim()) {
    url.searchParams.set("AreaCode", input.areaCode.trim());
  }

  const response = await input.fetchImpl(url.toString(), {
    headers: {
      authorization: basicAuth(input.accountSid, input.authToken)
    }
  });
  if (!response.ok) {
    throw new Error(`Twilio available-number search failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as TwilioAvailableNumbersResponse;
  const phoneNumber = body.available_phone_numbers?.[0]?.phone_number ?? body.available_phone_numbers?.[0]?.phoneNumber;
  if (!phoneNumber) {
    throw new Error("Twilio returned no available Voice+SMS local numbers.");
  }

  return normalizePhoneNumber(phoneNumber);
}

async function buyTwilioNumber(input: {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  voiceUrl: string;
  smsUrl: string;
  fetchImpl: typeof fetch;
}): Promise<{ phoneNumber: string; phoneNumberSid: string }> {
  const form = new URLSearchParams({
    PhoneNumber: input.phoneNumber,
    VoiceUrl: input.voiceUrl,
    VoiceMethod: "POST",
    SmsUrl: input.smsUrl,
    SmsMethod: "POST"
  });
  const response = await input.fetchImpl(
    `${TWILIO_API_BASE}/Accounts/${input.accountSid}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: {
        authorization: basicAuth(input.accountSid, input.authToken),
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  if (!response.ok) {
    throw new Error(`Twilio number purchase failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as TwilioIncomingPhoneNumberResponse;
  if (!body.sid || !body.phone_number) {
    throw new Error("Twilio number purchase returned an incomplete response.");
  }

  return {
    phoneNumber: normalizePhoneNumber(body.phone_number),
    phoneNumberSid: body.sid
  };
}

function basicAuth(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
