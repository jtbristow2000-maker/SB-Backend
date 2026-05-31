import type { BusinessRepository } from "@/server/business/bootstrap";
import type { CustomerProfileService } from "@/server/customerProfiles/service";
import type { CallRecordRow, CustomerProfileRow } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";
import type { CallProvider } from "@/server/providers";

import type { CallRecordRepository } from "./callRecords";

export const VOICE_STATUS_ACTION_URL = "/api/webhooks/twilio/voice/status";
export const OWNER_DIAL_TIMEOUT_SECONDS = 18;

export type IncomingVoicePayload = {
  from: string;
  to: string;
  callSid?: string;
};

export type IncomingVoiceResult = {
  status: "dial" | "business_not_found" | "owner_phone_missing";
  twiml: string;
  profile?: CustomerProfileRow;
  callRecord?: CallRecordRow;
};

export type VoiceIntakeDependencies = {
  businessRepository: BusinessRepository;
  customerProfileService: CustomerProfileService;
  callRecordRepository: CallRecordRepository;
  callProvider: CallProvider;
};

export class VoiceIntakeService {
  constructor(private readonly dependencies: VoiceIntakeDependencies) {}

  async handleIncomingVoice(payload: IncomingVoicePayload): Promise<IncomingVoiceResult> {
    const toPhone = normalizePhoneNumber(payload.to);
    const fromPhone = normalizePhoneNumber(payload.from);
    const business = await this.dependencies.businessRepository.findByBusinessPhone(toPhone);

    if (!business) {
      return {
        status: "business_not_found",
        twiml: this.dependencies.callProvider.buildSayTwiml("This business number is not configured.")
      };
    }

    if (!business.owner_phone_e164) {
      return {
        status: "owner_phone_missing",
        twiml: this.dependencies.callProvider.buildSayTwiml("The owner phone number is not configured.")
      };
    }

    const { profile } = await this.dependencies.customerProfileService.upsertByBusinessAndPhone({
      businessId: business.id,
      phone: fromPhone,
      source: "incoming_call",
      lastContactAt: new Date().toISOString()
    });

    const callRecord = await this.dependencies.callRecordRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      provider: "twilio",
      provider_call_id: payload.callSid ?? null,
      direction: "inbound",
      call_type: "missed",
      from_phone_e164: fromPhone,
      to_phone_e164: toPhone
    });

    return {
      status: "dial",
      profile,
      callRecord,
      twiml: this.dependencies.callProvider.buildDialTwiml({
        ownerPhoneE164: business.owner_phone_e164,
        actionUrl: VOICE_STATUS_ACTION_URL,
        timeoutSeconds: OWNER_DIAL_TIMEOUT_SECONDS
      })
    };
  }
}
