import { randomUUID } from "node:crypto";

import type { AppointmentRow, AppointmentStatus } from "@/server/db/schema";

export type AppointmentCreateInput = {
  business_id: string;
  customer_profile_id?: string | null;
  source_call_record_id?: string | null;
  title: string;
  service_requested?: string | null;
  scheduled_start_at: string;
  scheduled_end_at?: string | null;
  timezone?: string;
  status?: AppointmentStatus;
  location?: string | null;
  notes?: string | null;
};

export type AppointmentUpdateInput = Partial<Omit<AppointmentRow, "id" | "business_id" | "created_at">>;

export interface AppointmentRepository {
  create(input: AppointmentCreateInput): Promise<AppointmentRow>;
  findById(id: string): Promise<AppointmentRow | null>;
  update(id: string, input: AppointmentUpdateInput): Promise<AppointmentRow>;
  delete(id: string): Promise<void>;
  list(): Promise<AppointmentRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly appointments = new Map<string, AppointmentRow>();

  async create(input: AppointmentCreateInput): Promise<AppointmentRow> {
    const timestamp = nowIso();
    const appointment: AppointmentRow = {
      id: randomUUID(),
      business_id: input.business_id,
      customer_profile_id: input.customer_profile_id ?? null,
      source_call_record_id: input.source_call_record_id ?? null,
      title: input.title,
      service_requested: input.service_requested ?? null,
      scheduled_start_at: input.scheduled_start_at,
      scheduled_end_at: input.scheduled_end_at ?? null,
      timezone: input.timezone ?? "America/New_York",
      status: input.status ?? "scheduled",
      location: input.location ?? null,
      notes: input.notes ?? null,
      created_at: timestamp,
      updated_at: timestamp
    };

    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  async findById(id: string): Promise<AppointmentRow | null> {
    return this.appointments.get(id) ?? null;
  }

  async update(id: string, input: AppointmentUpdateInput): Promise<AppointmentRow> {
    const existing = this.appointments.get(id);
    if (!existing) {
      throw new Error(`Appointment not found: ${id}`);
    }

    const updated: AppointmentRow = {
      ...existing,
      ...input,
      id: existing.id,
      business_id: existing.business_id,
      created_at: existing.created_at,
      updated_at: nowIso()
    };

    this.appointments.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.appointments.delete(id);
  }

  async list(): Promise<AppointmentRow[]> {
    return Array.from(this.appointments.values());
  }
}
