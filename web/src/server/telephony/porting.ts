import type { BusinessRepository } from "@/server/business/bootstrap";
import { getAppConfig, type AppConfig } from "@/server/config";
import type { BusinessRow, NumberPortRequestRow } from "@/server/db/schema";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { normalizePhoneNumber } from "@/server/phone/normalize";

import type {
  NumberPortRequestCreateInput,
  NumberPortRequestRepository,
  NumberPortRequestUpdateInput
} from "./portRequests";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
const VOICE_WEBHOOK_PATH = "/api/webhooks/twilio/voice";
const SMS_WEBHOOK_PATH = "/api/webhooks/twilio/sms";

export type PortingDependencies = {
  businessRepository: BusinessRepository;
  numberPortRequestRepository: NumberPortRequestRepository;
  auditEventRepository?: AuditEventRepository;
  config?: AppConfig;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

export type PortRequestInput = Omit<
  NumberPortRequestCreateInput,
  "business_id" | "status"
> & {
  businessId: string;
};

export async function savePortRequest(
  input: PortRequestInput,
  dependencies?: PortingDependencies
): Promise<NumberPortRequestRow> {
  const deps = dependencies ?? (await defaultDependencies());
  await requireBusiness(deps.businessRepository, input.businessId);
  const existing = await deps.numberPortRequestRepository.findLatestByBusinessId(input.businessId);
  const payload: NumberPortRequestUpdateInput = {
    current_number_e164: input.current_number_e164,
    current_carrier: input.current_carrier ?? null,
    account_number: input.account_number ?? null,
    account_pin: input.account_pin ?? null,
    billing_name: input.billing_name ?? null,
    billing_address: input.billing_address ?? null,
    loa_signed_at: input.loa_signed_at ?? null,
    bill_uploaded: input.bill_uploaded ?? false
  };
  const request = existing
    ? await deps.numberPortRequestRepository.update(existing.id, payload)
    : await deps.numberPortRequestRepository.create({
        business_id: input.businessId,
        ...payload,
        current_number_e164: input.current_number_e164,
        status: "collecting"
      });

  await deps.auditEventRepository?.create({
    business_id: input.businessId,
    customer_profile_id: null,
    actor: "owner",
    event_type: "number.port_request.saved",
    event_json: {
      portRequestId: request.id,
      currentNumber: request.current_number_e164
    }
  });

  return request;
}

export async function submitPortRequest(
  businessId: string,
  dependencies?: PortingDependencies
): Promise<NumberPortRequestRow> {
  const deps = dependencies ?? (await defaultDependencies());
  await requireBusiness(deps.businessRepository, businessId);
  const existing = await deps.numberPortRequestRepository.findLatestByBusinessId(businessId);
  if (!existing) {
    throw new Error(`No number port request exists for business ${businessId}.`);
  }

  const request = await deps.numberPortRequestRepository.update(existing.id, {
    status: "submitted"
  });
  await deps.businessRepository.updateTelephony(businessId, {
    numberStatus: "porting"
  });
  await deps.auditEventRepository?.create({
    business_id: businessId,
    customer_profile_id: null,
    actor: "owner",
    event_type: "number.port_request.submitted",
    event_json: {
      portRequestId: request.id,
      currentNumber: request.current_number_e164,
      note: "Founder submits the port request through Twilio Console until Porting API support is enabled."
    }
  });

  return request;
}

export async function completePortForBusiness(
  businessId: string,
  dependencies?: PortingDependencies
): Promise<BusinessRow> {
  const deps = dependencies ?? (await defaultDependencies());
  const business = await requireBusiness(deps.businessRepository, businessId);
  const request = await deps.numberPortRequestRepository.findLatestByBusinessId(businessId);
  if (!request) {
    throw new Error(`No number port request exists for business ${businessId}.`);
  }

  await rewireTwilioNumberWebhooksSafe(deps, business);
  const updatedBusiness = await deps.businessRepository.updateTelephony(businessId, {
    twilioNumber: request.current_number_e164,
    numberStatus: "ported",
    numberTrialEndsAt: null
  });
  await deps.numberPortRequestRepository.update(request.id, {
    status: "completed"
  });
  await deps.auditEventRepository?.create({
    business_id: businessId,
    customer_profile_id: null,
    actor: "owner",
    event_type: "number.port.completed",
    event_json: {
      portRequestId: request.id,
      portedNumber: request.current_number_e164,
      twilioNumberSid: business.twilio_number_sid
    }
  });

  return updatedBusiness;
}

async function defaultDependencies(): Promise<PortingDependencies> {
  const rt = await getIntakeRuntime();
  return {
    businessRepository: rt.businessRepository,
    numberPortRequestRepository: rt.numberPortRequestRepository,
    auditEventRepository: rt.auditEventRepository
  };
}

async function requireBusiness(
  businessRepository: BusinessRepository,
  businessId: string
): Promise<BusinessRow> {
  const business = await businessRepository.findById(businessId);
  if (!business) {
    throw new Error(`Business ${businessId} was not found.`);
  }

  return business;
}

async function rewireTwilioNumberWebhooksSafe(
  deps: PortingDependencies,
  business: BusinessRow
): Promise<void> {
  const config = deps.config ?? getAppConfig();
  const env = deps.env ?? process.env;
  if (
    config.sandboxMode ||
    config.persistence === "memory" ||
    !business.twilio_number_sid ||
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !config.publicBaseUrl
  ) {
    return;
  }

  const form = new URLSearchParams({
    VoiceUrl: new URL(VOICE_WEBHOOK_PATH, config.publicBaseUrl).toString(),
    VoiceMethod: "POST",
    SmsUrl: new URL(SMS_WEBHOOK_PATH, config.publicBaseUrl).toString(),
    SmsMethod: "POST"
  });
  const response = await (deps.fetchImpl ?? fetch)(
    `${TWILIO_API_BASE}/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${business.twilio_number_sid}.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  if (!response.ok) {
    throw new Error(`Twilio number webhook rewire failed with HTTP ${response.status}.`);
  }
}

export function normalizePortedNumber(phone: string): string {
  return normalizePhoneNumber(phone);
}
