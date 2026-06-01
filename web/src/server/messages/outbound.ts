import type { CustomerProfileRepository } from "@/server/customerProfiles/repository";
import type { BusinessRow, CustomerProfileRow, MessageRow } from "@/server/db/schema";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import type { MessageRepository } from "@/server/intake/messages";
import type { SmsProvider } from "@/server/providers";

export type OwnerMessagePayload = {
  profile_id: string;
  body: string;
};

export type OwnerMessageValidation =
  | { ok: true; payload: OwnerMessagePayload }
  | { ok: false; status: number; error: string; fields?: string[] };

export type OwnerMessageResult =
  | { status: "created"; message: MessageRow; profile: CustomerProfileRow }
  | { status: "profile_not_found" }
  | { status: "profile_phone_missing" };

export type OwnerMessageDependencies = {
  customerProfileRepository: CustomerProfileRepository;
  messageRepository: MessageRepository;
  auditEventRepository: AuditEventRepository;
  smsProvider: SmsProvider;
  isSmsSendingEnabled: () => boolean;
};

const REQUIRED_FIELDS = ["profile_id", "body"] as const;

export function validateOwnerMessagePayload(payload: unknown): OwnerMessageValidation {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_message_payload"
    };
  }

  const record = payload as Record<string, unknown>;
  const invalidFields = REQUIRED_FIELDS.filter(
    (field) => typeof record[field] !== "string" || record[field].trim().length === 0
  );

  if (invalidFields.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "invalid_message_field_values",
      fields: invalidFields
    };
  }

  const profileId = record.profile_id as string;
  const body = record.body as string;

  return {
    ok: true,
    payload: {
      profile_id: profileId.trim(),
      body: body.trim()
    }
  };
}

export async function sendOwnerApprovedSms(
  dependencies: OwnerMessageDependencies,
  input: {
    business: BusinessRow;
    payload: OwnerMessagePayload;
  }
): Promise<OwnerMessageResult> {
  const profiles = await dependencies.customerProfileRepository.list();
  const profile =
    profiles.find(
      (candidate) =>
        candidate.business_id === input.business.id &&
        candidate.id === input.payload.profile_id
    ) ?? null;

  if (!profile) {
    return { status: "profile_not_found" };
  }

  if (!profile.phone_e164) {
    return { status: "profile_phone_missing" };
  }

  const smsSendingEnabled = dependencies.isSmsSendingEnabled();
  const sentAt = new Date().toISOString();
  let message = await dependencies.messageRepository.create({
    business_id: input.business.id,
    customer_profile_id: profile.id,
    provider: dependencies.smsProvider.providerName,
    provider_message_id: null,
    direction: "outbound",
    channel: "sms",
    from_phone_e164: input.business.business_phone_e164,
    to_phone_e164: profile.phone_e164,
    body: input.payload.body,
    status: "queued",
    sent_at: null,
    created_at: sentAt
  });

  if (smsSendingEnabled) {
    try {
      const result = await dependencies.smsProvider.sendMessage({
        businessId: input.business.id,
        to: profile.phone_e164,
        from: input.business.business_phone_e164 ?? undefined,
        body: input.payload.body
      });

      if (result.networkCallsMade) {
        message = await dependencies.messageRepository.update(message.id, {
          status: "sent",
          sent_at: sentAt
        });
      }
    } catch {
      message = await dependencies.messageRepository.update(message.id, {
        status: "failed",
        sent_at: null
      });
    }
  }
  const updatedProfile = await dependencies.customerProfileRepository.update(profile.id, {
    last_contact_at: sentAt
  });

  await dependencies.auditEventRepository.create({
    business_id: input.business.id,
    customer_profile_id: profile.id,
    actor: "owner",
    event_type: `message.owner_sms.${message.status}`,
    event_json: {
      messageId: message.id,
      profileId: profile.id,
      smsSendingEnabled
    }
  });

  return {
    status: "created",
    message,
    profile: updatedProfile
  };
}
