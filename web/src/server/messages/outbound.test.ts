import { describe, expect, it } from "vitest";

import { bootstrapSingleTenantBusiness, InMemoryBusinessRepository } from "@/server/business/bootstrap";
import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { InMemoryAuditEventRepository } from "@/server/intake/auditEvents";
import { InMemoryMessageRepository } from "@/server/intake/messages";
import type { SmsProvider, SmsSendInput } from "@/server/providers";

import { sendOwnerApprovedSms } from "./outbound";

describe("owner outbound SMS", () => {
  it("does not delay owner-initiated manual sends when auto-text delay is configured", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    await bootstrapSingleTenantBusiness(businessRepository, {
      id: "00000000-0000-4000-8000-000000000701",
      name: "Manual Send Detail Co",
      ownerName: "Owner",
      ownerPhone: "(213) 373-4253",
      businessPhone: "(310) 555-0199",
      timezone: "America/New_York"
    });
    const business = await businessRepository.updateSettings(
      "00000000-0000-4000-8000-000000000701",
      {
        auto_text_delay_seconds: 120
      }
    );
    const customerProfileRepository = new InMemoryCustomerProfileRepository();
    const messageRepository = new InMemoryMessageRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    const profile = await customerProfileRepository.create({
      business_id: business.id,
      display_name: "Shaw",
      phone_e164: "+19495550100",
      email: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      source: "manual",
      status: "new",
      summary: null,
      notes: null,
      last_contact_at: null
    });
    const smsCalls: SmsSendInput[] = [];
    const smsProvider: SmsProvider = {
      providerName: "fake",
      async sendMessage(payload) {
        smsCalls.push(payload);
        return {
          provider: "fake",
          status: "completed",
          action: "sms.send.fake",
          networkCallsMade: true
        };
      },
      async recordInboundMessage() {
        return {
          provider: "fake",
          status: "logged",
          action: "sms.inbound.fake",
          networkCallsMade: false
        };
      }
    };

    const result = await sendOwnerApprovedSms(
      {
        customerProfileRepository,
        messageRepository,
        auditEventRepository,
        smsProvider,
        isSmsSendingEnabled: () => true
      },
      {
        business,
        payload: {
          profile_id: profile.id,
          body: "I can get you on the schedule."
        }
      }
    );

    expect(result.status).toBe("created");
    if (result.status !== "created") {
      throw new Error(`Expected owner SMS to be created, got ${result.status}`);
    }
    expect(smsCalls).toHaveLength(1);
    expect(result.message.status).toBe("sent");
    expect(result.message.body).toBe("I can get you on the schedule.");
  });

  it("uses the shared number for owner SMS when the business has no dedicated Twilio number", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    const business = await bootstrapSingleTenantBusiness(businessRepository, {
      id: "00000000-0000-4000-8000-000000000702",
      name: "Shared Manual Send Co",
      ownerName: "Owner",
      ownerPhone: "(213) 373-4253",
      businessPhone: "(310) 555-0199",
      timezone: "America/New_York"
    });
    const customerProfileRepository = new InMemoryCustomerProfileRepository();
    const messageRepository = new InMemoryMessageRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    const profile = await customerProfileRepository.create({
      business_id: business.id,
      display_name: "Shaw",
      phone_e164: "+19495550100",
      email: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      source: "manual",
      status: "new",
      summary: null,
      notes: null,
      last_contact_at: null
    });
    const smsCalls: SmsSendInput[] = [];
    const smsProvider: SmsProvider = {
      providerName: "fake",
      async sendMessage(payload) {
        smsCalls.push(payload);
        return {
          provider: "fake",
          status: "completed",
          action: "sms.send.fake",
          networkCallsMade: true
        };
      },
      async recordInboundMessage() {
        return {
          provider: "fake",
          status: "logged",
          action: "sms.inbound.fake",
          networkCallsMade: false
        };
      }
    };

    const result = await sendOwnerApprovedSms(
      {
        customerProfileRepository,
        messageRepository,
        auditEventRepository,
        smsProvider,
        isSmsSendingEnabled: () => true,
        getSharedNumberE164: () => "+18664819747"
      },
      {
        business,
        payload: {
          profile_id: profile.id,
          body: "I can help with that."
        }
      }
    );

    expect(result.status).toBe("created");
    if (result.status !== "created") {
      throw new Error(`Expected owner SMS to be created, got ${result.status}`);
    }
    expect(result.message.from_phone_e164).toBe("+18664819747");
    expect(smsCalls[0]).toMatchObject({
      businessId: business.id,
      from: "+18664819747",
      to: "+19495550100",
      body: "I can help with that."
    });
  });
});
