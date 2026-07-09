import type { BusinessRepository } from "@/server/business/bootstrap";
import type { CustomerProfileRepository } from "@/server/customerProfiles/repository";
import type { CustomerProfileService } from "@/server/customerProfiles/service";
import type { MessageRow, TaskRow } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";
import { resolveBusinessForInboundSms } from "@/server/telephony/routing";

import type { AuditEventRepository } from "./auditEvents";
import type { MessageRepository } from "./messages";
import type { TaskRepository } from "./tasks";

export type InboundSmsPayload = {
  from: string;
  to: string;
  body?: string | null;
  messageSid?: string | null;
};

export type InboundSmsResult = {
  status: "stored" | "business_not_found";
  message?: MessageRow;
  customerProfileId?: string;
  flaggedTask?: TaskRow;
};

export type SmsIntakeDependencies = {
  businessRepository: BusinessRepository;
  customerProfileRepository: CustomerProfileRepository;
  customerProfileService: CustomerProfileService;
  messageRepository: MessageRepository;
  taskRepository: TaskRepository;
  auditEventRepository?: AuditEventRepository;
  getSharedNumberE164?: () => string | null;
};

export class SmsIntakeService {
  constructor(private readonly dependencies: SmsIntakeDependencies) {}

  async handleInboundSms(payload: InboundSmsPayload): Promise<InboundSmsResult> {
    const fromPhone = normalizePhoneNumber(payload.from);
    const toPhone = normalizePhoneNumber(payload.to);
    const businessMatch = await resolveBusinessForInboundSms({
      businessRepository: this.dependencies.businessRepository,
      customerProfileRepository: this.dependencies.customerProfileRepository,
      auditEventRepository: this.dependencies.auditEventRepository,
      fromE164: fromPhone,
      toE164: toPhone,
      sharedNumberE164: this.dependencies.getSharedNumberE164?.() ?? null
    });
    const business = businessMatch?.business ?? null;

    if (!business) {
      return { status: "business_not_found" };
    }

    const lastContactAt = new Date().toISOString();
    const profile = businessMatch?.customerProfile
      ? await this.dependencies.customerProfileRepository.update(businessMatch.customerProfile.id, {
          last_contact_at: lastContactAt
        })
      : (
          await this.dependencies.customerProfileService.upsertByBusinessAndPhone({
            businessId: business.id,
            phone: fromPhone,
            source: "inbound_sms",
            lastContactAt
          })
        ).profile;
    const existingMessage = payload.messageSid
      ? await this.dependencies.messageRepository.findByProviderMessageId(
          business.id,
          payload.messageSid
        )
      : null;
    const message = existingMessage
      ? await this.dependencies.messageRepository.update(existingMessage.id, {
          customer_profile_id: profile.id,
          provider: "twilio",
          provider_message_id: payload.messageSid,
          direction: "inbound",
          channel: "sms",
          from_phone_e164: fromPhone,
          to_phone_e164: toPhone,
          body: payload.body ?? existingMessage.body ?? "",
          status: "received",
          sent_at: lastContactAt
        })
      : await this.dependencies.messageRepository.create({
          business_id: business.id,
          customer_profile_id: profile.id,
          provider: "twilio",
          provider_message_id: payload.messageSid ?? null,
          direction: "inbound",
          channel: "sms",
          from_phone_e164: fromPhone,
          to_phone_e164: toPhone,
          body: payload.body ?? "",
          status: "received",
          sent_at: lastContactAt
        });
    const openCallbackTask = await this.dependencies.taskRepository.findOpenCallbackTask(profile.id);
    const flaggedTask = openCallbackTask
      ? openCallbackTask.notes?.includes("Customer replied by SMS.")
        ? openCallbackTask
        : await this.dependencies.taskRepository.update(openCallbackTask.id, {
            notes: [openCallbackTask.notes, "Customer replied by SMS."].filter(Boolean).join("\n")
          })
      : undefined;

    return {
      status: "stored",
      message,
      customerProfileId: profile.id,
      flaggedTask
    };
  }
}
