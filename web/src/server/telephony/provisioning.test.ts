import { describe, expect, it } from "vitest";

import { InMemoryBusinessRepository } from "@/server/business/bootstrap";
import type { AppConfig } from "@/server/config";
import { InMemoryAuditEventRepository } from "@/server/intake/auditEvents";

import { provisionNumberForBusiness } from "./provisioning";

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    appBaseUrl: "http://localhost:3000",
    publicBaseUrl: null,
    sharedNumberE164: null,
    adminEmails: [],
    apiKeyConfigured: false,
    environment: "test",
    persistence: "memory",
    sandboxMode: true,
    simulatorEnabled: true,
    webhookSignatureRequired: false,
    smsSendingEnabled: false,
    callForwardingEnabled: false,
    fastTranscriptionEnabled: false,
    realMessageSendingEnabled: false,
    realCallAutomationEnabled: false,
    supabaseConfigured: false,
    twilioConfigured: false,
    twilioAutoProvision: false,
    twilioDefaultAreaCode: null,
    openAiConfigured: false,
    anthropicConfigured: false,
    aiExtractionEnabled: false,
    sentryConfigured: false,
    ...overrides
  };
}

async function seedBusiness(repository: InMemoryBusinessRepository) {
  return repository.create({
    id: "00000000-0000-4000-8000-000000000701",
    name: "Number Detail Co",
    ownerName: "Owner",
    ownerPhone: "+12133734253",
    businessPhone: "+13105550199",
    timezone: "America/New_York"
  });
}

describe("business number provisioning", () => {
  it("simulates trial number provisioning without network calls in sandbox/memory mode", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    const business = await seedBusiness(businessRepository);
    let fetchCalled = false;

    const result = await provisionNumberForBusiness(
      business.id,
      { areaCode: "213" },
      {
        businessRepository,
        auditEventRepository,
        config: config(),
        now: new Date("2026-06-03T12:00:00.000Z"),
        fetchImpl: async () => {
          fetchCalled = true;
          throw new Error("network should not be called");
        }
      }
    );
    const updated = await businessRepository.findById(business.id);

    expect(fetchCalled).toBe(false);
    expect(result.status).toBe("simulated");
    expect(result.networkCallsMade).toBe(false);
    expect(updated).toMatchObject({
      twilio_number_e164: result.phoneNumber,
      twilio_number_sid: result.phoneNumberSid,
      number_status: "trial",
      number_trial_ends_at: "2026-06-17T12:00:00.000Z"
    });
    expect(await auditEventRepository.list()).toHaveLength(1);
  });

  it("uses Twilio REST with public webhook URLs only when real provisioning is explicitly enabled", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    const business = await seedBusiness(businessRepository);
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("AvailablePhoneNumbers")) {
        return Response.json({
          available_phone_numbers: [{ phone_number: "+14155550100" }]
        });
      }

      return Response.json({
        sid: "PN_REAL_TEST",
        phone_number: "+14155550100"
      });
    };

    const result = await provisionNumberForBusiness(
      business.id,
      {},
      {
        businessRepository,
        config: config({
          persistence: "supabase",
          sandboxMode: false,
          twilioAutoProvision: true,
          publicBaseUrl: "https://jobs.example.com",
          twilioDefaultAreaCode: "415"
        }),
        env: {
          NODE_ENV: "test",
          TWILIO_ACCOUNT_SID: "AC_TEST",
          TWILIO_AUTH_TOKEN: "twilio-token"
        },
        fetchImpl,
        now: new Date("2026-06-03T12:00:00.000Z")
      }
    );
    const buyBody = String(calls[1].init?.body);

    expect(result.status).toBe("provisioned");
    expect(result.networkCallsMade).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("AreaCode=415");
    expect(buyBody).toContain("VoiceUrl=https%3A%2F%2Fjobs.example.com%2Fapi%2Fwebhooks%2Ftwilio%2Fvoice");
    expect(buyBody).toContain("SmsUrl=https%3A%2F%2Fjobs.example.com%2Fapi%2Fwebhooks%2Ftwilio%2Fsms");
  });
});
