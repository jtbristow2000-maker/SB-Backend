import { randomUUID } from "node:crypto";

import type { AuditActor, AuditEventRow, JsonValue } from "@/server/db/schema";

export type AuditEventCreateInput = {
  business_id: string;
  customer_profile_id?: string | null;
  actor: AuditActor;
  event_type: string;
  event_json?: JsonValue;
};

export interface AuditEventRepository {
  create(input: AuditEventCreateInput): Promise<AuditEventRow>;
  list(): Promise<AuditEventRow[]>;
}

export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly auditEvents = new Map<string, AuditEventRow>();

  async create(input: AuditEventCreateInput): Promise<AuditEventRow> {
    const auditEvent: AuditEventRow = {
      id: randomUUID(),
      business_id: input.business_id,
      customer_profile_id: input.customer_profile_id ?? null,
      actor: input.actor,
      event_type: input.event_type,
      event_json: input.event_json ?? {},
      created_at: new Date().toISOString()
    };

    this.auditEvents.set(auditEvent.id, auditEvent);
    return auditEvent;
  }

  async list(): Promise<AuditEventRow[]> {
    return Array.from(this.auditEvents.values());
  }
}
