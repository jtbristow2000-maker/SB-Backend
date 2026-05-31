import { randomUUID } from "node:crypto";

import type { MessageRow } from "@/server/db/schema";

export type MessageCreateInput = {
  business_id: string;
  customer_profile_id?: string | null;
  provider?: string;
  provider_message_id?: string | null;
  direction: MessageRow["direction"];
  channel: MessageRow["channel"];
  from_phone_e164?: string | null;
  to_phone_e164?: string | null;
  body?: string | null;
  media_json?: MessageRow["media_json"];
  status?: string;
  sent_at?: string | null;
  created_at?: string | null;
};

export interface MessageRepository {
  create(input: MessageCreateInput): Promise<MessageRow>;
  update(id: string, input: Partial<Omit<MessageRow, "id" | "business_id" | "created_at">>): Promise<MessageRow>;
  findByProviderMessageId(providerMessageId: string): Promise<MessageRow | null>;
  findByProviderMessageId(businessId: string, providerMessageId: string): Promise<MessageRow | null>;
  list(): Promise<MessageRow[]>;
}

export class InMemoryMessageRepository implements MessageRepository {
  private readonly messages = new Map<string, MessageRow>();

  async create(input: MessageCreateInput): Promise<MessageRow> {
    const message: MessageRow = {
      id: randomUUID(),
      business_id: input.business_id,
      customer_profile_id: input.customer_profile_id ?? null,
      provider: input.provider ?? "sandbox",
      provider_message_id: input.provider_message_id ?? null,
      direction: input.direction,
      channel: input.channel,
      from_phone_e164: input.from_phone_e164 ?? null,
      to_phone_e164: input.to_phone_e164 ?? null,
      body: input.body ?? null,
      media_json: input.media_json ?? {},
      status: input.status ?? "queued",
      sent_at: input.sent_at ?? null,
      created_at: input.created_at ?? new Date().toISOString()
    };

    this.messages.set(message.id, message);
    return message;
  }

  async update(
    id: string,
    input: Partial<Omit<MessageRow, "id" | "business_id" | "created_at">>
  ): Promise<MessageRow> {
    const existing = this.messages.get(id);
    if (!existing) {
      throw new Error(`Message not found: ${id}`);
    }

    const updated: MessageRow = {
      ...existing,
      ...input,
      id: existing.id,
      business_id: existing.business_id,
      created_at: existing.created_at
    };

    this.messages.set(id, updated);
    return updated;
  }

  async findByProviderMessageId(
    providerMessageId: string
  ): Promise<MessageRow | null>;
  async findByProviderMessageId(
    businessId: string,
    providerMessageId?: string
  ): Promise<MessageRow | null> {
    if (providerMessageId === undefined) {
      return (
        Array.from(this.messages.values()).find(
          (message) => message.provider_message_id === businessId
        ) ?? null
      );
    }

    return (
      Array.from(this.messages.values()).find(
        (message) =>
          message.business_id === businessId &&
          message.provider_message_id === providerMessageId
      ) ?? null
    );
  }

  async list(): Promise<MessageRow[]> {
    return Array.from(this.messages.values());
  }
}
