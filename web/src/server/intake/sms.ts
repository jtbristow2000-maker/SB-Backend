import type { BusinessRepository } from "@/server/business/bootstrap";
import type { CustomerProfileService } from "@/server/customerProfiles/service";
import type { MessageRow, TaskRow } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";

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
  customerProfileService: CustomerProfileService;
  messageRepository: MessageRepository;
  taskRepository: TaskRepository;
};

export class SmsIntakeService {
  constructor(private readonly dependencies: SmsIntakeDependencies) {}

  async handleInboundSms(payload: InboundSmsPayload): Promise<InboundSmsResult> {
    const fromPhone = normalizePhoneNumber(payload.from);
    const toPhone = normalizePhoneNumber(payload.to);
    const business = await this.dependencies.businessRepository.findByBusinessPhone(toPhone);

    if (!business) {
      return { status: "business_not_found" };
    }

    const lastContactAt = new Date().toISOString();
    const { profile } = await this.dependencies.customerProfileService.upsertByBusinessAndPhone({
      businessId: business.id,
      phone: fromPhone,
      source: "inbound_sms",
      lastContactAt
    });
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
