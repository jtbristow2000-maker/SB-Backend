import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BusinessRepository,
  BusinessSeedInput
} from "@/server/business/bootstrap";
import type {
  BusinessMemberCreateInput,
  BusinessMemberRepository
} from "@/server/business/membership";
import type { BusinessSettingsUpdate } from "@/server/business/settings";
import { mergeBusinessSettingsJson } from "@/server/business/settings";
import type {
  CustomerProfileCreateInput,
  CustomerProfileRepository,
  CustomerProfileUpdateInput
} from "@/server/customerProfiles/repository";
import type {
  AppointmentCreateInput,
  AppointmentRepository
} from "@/server/intake/appointments";
import type {
  AuditEventCreateInput,
  AuditEventRepository
} from "@/server/intake/auditEvents";
import type {
  CallRecordCreateInput,
  CallRecordRepository
} from "@/server/intake/callRecords";
import type {
  MessageCreateInput,
  MessageRepository
} from "@/server/intake/messages";
import type {
  QuoteDraftCreateInput,
  QuoteDraftRepository
} from "@/server/intake/quoteDrafts";
import type {
  TaskCreateInput,
  TaskRepository
} from "@/server/intake/tasks";
import { normalizePhoneNumber } from "@/server/phone/normalize";

import type {
  AppointmentRow,
  AuditEventRow,
  BusinessMemberRow,
  BusinessRow,
  CallRecordRow,
  CustomerProfileRow,
  Database,
  MessageRow,
  QuoteDraftRow,
  TaskRow
} from "./schema";

type SupabaseErrorLike = { message: string } | null;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeOptionalPhone(phone?: string | null): string | null {
  return phone ? normalizePhoneNumber(phone) : null;
}

function failIfError(error: SupabaseErrorLike, action: string): void {
  if (error) {
    throw new Error(`Supabase ${action} failed: ${error.message}`);
  }
}

function requireRow<T>(data: T | null, error: SupabaseErrorLike, action: string): T {
  failIfError(error, action);
  if (!data) {
    throw new Error(`Supabase ${action} returned no row.`);
  }

  return data;
}

function rowsOrThrow<T>(data: T[] | null, error: SupabaseErrorLike, action: string): T[] {
  failIfError(error, action);
  return data ?? [];
}

export class SupabaseBusinessRepository implements BusinessRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findById(id: string): Promise<BusinessRow | null> {
    const { data, error } = await this.client
      .from("businesses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    failIfError(error, "find business by id");
    return data;
  }

  async findByBusinessPhone(phoneE164: string): Promise<BusinessRow | null> {
    const { data, error } = await this.client
      .from("businesses")
      .select("*")
      .eq("business_phone_e164", phoneE164)
      .maybeSingle();
    failIfError(error, "find business by phone");
    return data;
  }

  async create(input: BusinessSeedInput & { id: string }): Promise<BusinessRow> {
    const timestamp = nowIso();
    const { data, error } = await this.client
      .from("businesses")
      .insert({
        id: input.id,
        name: input.name,
        owner_name: input.ownerName ?? null,
        owner_phone_e164: normalizeOptionalPhone(input.ownerPhone),
        business_phone_e164: normalizeOptionalPhone(input.businessPhone),
        timezone: input.timezone,
        settings_json: {},
        updated_at: timestamp
      })
      .select("*")
      .single();

    return requireRow(data, error, "create business");
  }

  async update(id: string, input: BusinessSeedInput): Promise<BusinessRow> {
    const existing = await this.findById(id);
    if (!existing) {
      return this.create({ ...input, id });
    }

    const { data, error } = await this.client
      .from("businesses")
      .update({
        name: input.name,
        owner_name: input.ownerName ?? null,
        owner_phone_e164: normalizeOptionalPhone(input.ownerPhone),
        business_phone_e164: normalizeOptionalPhone(input.businessPhone),
        timezone: input.timezone,
        updated_at: nowIso()
      })
      .eq("id", id)
      .select("*")
      .single();

    return requireRow(data, error, "update business");
  }

  async updateSettings(id: string, partial: BusinessSettingsUpdate): Promise<BusinessRow> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Business ${id} was not found.`);
    }

    const { data, error } = await this.client
      .from("businesses")
      .update({
        settings_json: mergeBusinessSettingsJson(existing.settings_json, partial),
        updated_at: nowIso()
      })
      .eq("id", id)
      .select("*")
      .single();

    return requireRow(data, error, "update business settings");
  }

  async list(): Promise<BusinessRow[]> {
    const { data, error } = await this.client.from("businesses").select("*");
    return rowsOrThrow(data, error, "list businesses");
  }
}

export class SupabaseBusinessMemberRepository implements BusinessMemberRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findByUserId(userId: string): Promise<BusinessMemberRow[]> {
    const { data, error } = await this.client
      .from("business_members")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    return rowsOrThrow(data, error, "find business memberships by user");
  }

  async findByBusinessAndUser(
    businessId: string,
    userId: string
  ): Promise<BusinessMemberRow | null> {
    const { data, error } = await this.client
      .from("business_members")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    failIfError(error, "find business membership");
    return data;
  }

  async create(input: BusinessMemberCreateInput): Promise<BusinessMemberRow> {
    const existing = await this.findByBusinessAndUser(input.business_id, input.user_id);
    if (existing) {
      return existing;
    }

    const { data, error } = await this.client
      .from("business_members")
      .insert({
        business_id: input.business_id,
        user_id: input.user_id,
        role: input.role ?? "owner"
      })
      .select("*")
      .single();

    return requireRow(data, error, "create business membership");
  }

  async list(): Promise<BusinessMemberRow[]> {
    const { data, error } = await this.client.from("business_members").select("*");
    return rowsOrThrow(data, error, "list business memberships");
  }
}

export class SupabaseCustomerProfileRepository implements CustomerProfileRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findByBusinessAndPhone(
    businessId: string,
    phoneE164: string
  ): Promise<CustomerProfileRow | null> {
    const { data, error } = await this.client
      .from("customer_profiles")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();
    failIfError(error, "find customer profile by phone");
    return data;
  }

  async create(input: CustomerProfileCreateInput): Promise<CustomerProfileRow> {
    const { data, error } = await this.client
      .from("customer_profiles")
      .insert(input)
      .select("*")
      .single();

    return requireRow(data, error, "create customer profile");
  }

  async update(id: string, input: CustomerProfileUpdateInput): Promise<CustomerProfileRow> {
    const { data, error } = await this.client
      .from("customer_profiles")
      .update({
        ...input,
        updated_at: nowIso()
      })
      .eq("id", id)
      .select("*")
      .single();

    return requireRow(data, error, "update customer profile");
  }

  async list(): Promise<CustomerProfileRow[]> {
    const { data, error } = await this.client.from("customer_profiles").select("*");
    return rowsOrThrow(data, error, "list customer profiles");
  }
}

export class SupabaseCallRecordRepository implements CallRecordRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: CallRecordCreateInput): Promise<CallRecordRow> {
    const timestamp = nowIso();
    const { data, error } = await this.client
      .from("call_records")
      .insert({
        business_id: input.business_id,
        customer_profile_id: input.customer_profile_id ?? null,
        provider: input.provider ?? "sandbox",
        provider_call_id: input.provider_call_id ?? null,
        direction: input.direction,
        call_type: input.call_type,
        from_phone_e164: input.from_phone_e164 ?? null,
        to_phone_e164: input.to_phone_e164 ?? null,
        started_at: input.started_at ?? timestamp,
        ended_at: input.ended_at ?? null,
        duration_seconds: input.duration_seconds ?? null,
        recording_url: input.recording_url ?? null,
        transcript: input.transcript ?? null,
        ai_summary: input.ai_summary ?? null,
        extracted_json: input.extracted_json ?? {},
        needs_review: input.needs_review ?? false
      })
      .select("*")
      .single();

    return requireRow(data, error, "create call record");
  }

  async update(
    id: string,
    input: Partial<Omit<CallRecordRow, "id" | "created_at">>
  ): Promise<CallRecordRow> {
    const { data, error } = await this.client
      .from("call_records")
      .update({
        ...input,
        updated_at: nowIso()
      })
      .eq("id", id)
      .select("*")
      .single();

    return requireRow(data, error, "update call record");
  }

  async findByProviderCallId(providerCallId: string): Promise<CallRecordRow | null>;
  async findByProviderCallId(
    businessId: string,
    providerCallId?: string
  ): Promise<CallRecordRow | null> {
    let query = this.client.from("call_records").select("*");
    if (providerCallId === undefined) {
      query = query.eq("provider_call_id", businessId);
    } else {
      query = query.eq("business_id", businessId).eq("provider_call_id", providerCallId);
    }

    const { data, error } = await query.maybeSingle();
    failIfError(error, "find call record by provider id");
    return data;
  }

  async list(): Promise<CallRecordRow[]> {
    const { data, error } = await this.client.from("call_records").select("*");
    return rowsOrThrow(data, error, "list call records");
  }
}

export class SupabaseMessageRepository implements MessageRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: MessageCreateInput): Promise<MessageRow> {
    const { data, error } = await this.client
      .from("messages")
      .insert({
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
        created_at: input.created_at ?? nowIso()
      })
      .select("*")
      .single();

    return requireRow(data, error, "create message");
  }

  async update(
    id: string,
    input: Partial<Omit<MessageRow, "id" | "business_id" | "created_at">>
  ): Promise<MessageRow> {
    const { data, error } = await this.client
      .from("messages")
      .update(input)
      .eq("id", id)
      .select("*")
      .single();

    return requireRow(data, error, "update message");
  }

  async findByProviderMessageId(providerMessageId: string): Promise<MessageRow | null>;
  async findByProviderMessageId(
    businessId: string,
    providerMessageId?: string
  ): Promise<MessageRow | null> {
    let query = this.client.from("messages").select("*");
    if (providerMessageId === undefined) {
      query = query.eq("provider_message_id", businessId);
    } else {
      query = query.eq("business_id", businessId).eq("provider_message_id", providerMessageId);
    }

    const { data, error } = await query.maybeSingle();
    failIfError(error, "find message by provider id");
    return data;
  }

  async list(): Promise<MessageRow[]> {
    const { data, error } = await this.client.from("messages").select("*");
    return rowsOrThrow(data, error, "list messages");
  }
}

export class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: TaskCreateInput): Promise<TaskRow> {
    const { data, error } = await this.client
      .from("tasks")
      .insert({
        business_id: input.business_id,
        customer_profile_id: input.customer_profile_id ?? null,
        task_type: input.task_type,
        title: input.title,
        notes: input.notes ?? null,
        due_at: input.due_at ?? null,
        status: input.status ?? "open"
      })
      .select("*")
      .single();

    return requireRow(data, error, "create task");
  }

  async update(
    id: string,
    input: Partial<Omit<TaskRow, "id" | "business_id" | "created_at">>
  ): Promise<TaskRow> {
    const { data, error } = await this.client
      .from("tasks")
      .update({
        ...input,
        updated_at: nowIso()
      })
      .eq("id", id)
      .select("*")
      .single();

    return requireRow(data, error, "update task");
  }

  async findOpenCallbackTask(customerProfileId: string): Promise<TaskRow | null> {
    const { data, error } = await this.client
      .from("tasks")
      .select("*")
      .eq("customer_profile_id", customerProfileId)
      .eq("task_type", "callback")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    failIfError(error, "find open callback task");
    return data;
  }

  async list(): Promise<TaskRow[]> {
    const { data, error } = await this.client.from("tasks").select("*");
    return rowsOrThrow(data, error, "list tasks");
  }
}

export class SupabaseAuditEventRepository implements AuditEventRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: AuditEventCreateInput): Promise<AuditEventRow> {
    const { data, error } = await this.client
      .from("audit_events")
      .insert({
        business_id: input.business_id,
        customer_profile_id: input.customer_profile_id ?? null,
        actor: input.actor,
        event_type: input.event_type,
        event_json: input.event_json ?? {}
      })
      .select("*")
      .single();

    return requireRow(data, error, "create audit event");
  }

  async list(): Promise<AuditEventRow[]> {
    const { data, error } = await this.client.from("audit_events").select("*");
    return rowsOrThrow(data, error, "list audit events");
  }
}

export class SupabaseAppointmentRepository implements AppointmentRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: AppointmentCreateInput): Promise<AppointmentRow> {
    const { data, error } = await this.client
      .from("appointments")
      .insert({
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
        notes: input.notes ?? null
      })
      .select("*")
      .single();

    return requireRow(data, error, "create appointment");
  }

  async findById(id: string): Promise<AppointmentRow | null> {
    const { data, error } = await this.client
      .from("appointments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    failIfError(error, "find appointment by id");
    return data;
  }

  async update(
    id: string,
    input: Partial<Omit<AppointmentRow, "id" | "business_id" | "created_at">>
  ): Promise<AppointmentRow> {
    const { data, error } = await this.client
      .from("appointments")
      .update({ ...input, updated_at: nowIso() })
      .eq("id", id)
      .select("*")
      .single();

    return requireRow(data, error, "update appointment");
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("appointments").delete().eq("id", id);
    failIfError(error, "delete appointment");
  }

  async list(): Promise<AppointmentRow[]> {
    const { data, error } = await this.client.from("appointments").select("*");
    return rowsOrThrow(data, error, "list appointments");
  }
}

export class SupabaseQuoteDraftRepository implements QuoteDraftRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async create(input: QuoteDraftCreateInput): Promise<QuoteDraftRow> {
    const { data, error } = await this.client
      .from("quote_drafts")
      .insert({
        business_id: input.business_id,
        customer_profile_id: input.customer_profile_id ?? null,
        source_call_record_id: input.source_call_record_id ?? null,
        service_requested: input.service_requested ?? null,
        job_address: input.job_address ?? null,
        scope_notes: input.scope_notes ?? null,
        timeline: input.timeline ?? null,
        budget_hint: input.budget_hint ?? null,
        estimated_amount: input.estimated_amount ?? null,
        status: input.status ?? "draft"
      })
      .select("*")
      .single();

    return requireRow(data, error, "create quote draft");
  }

  async list(): Promise<QuoteDraftRow[]> {
    const { data, error } = await this.client.from("quote_drafts").select("*");
    return rowsOrThrow(data, error, "list quote drafts");
  }
}

export type IntakeRepositories = {
  businessRepository: BusinessRepository;
  businessMemberRepository: BusinessMemberRepository;
  customerProfileRepository: CustomerProfileRepository;
  callRecordRepository: CallRecordRepository;
  messageRepository: MessageRepository;
  taskRepository: TaskRepository;
  auditEventRepository: AuditEventRepository;
  appointmentRepository: AppointmentRepository;
  quoteDraftRepository: QuoteDraftRepository;
};

// Return the repositories typed as their interfaces (not the concrete classes) so
// callers — and tests — see the full interface surface, e.g. the 2-arg
// findByProviderCallId/findByProviderMessageId overloads that the concrete classes
// only expose via their implementation signature.
export function createSupabaseRepositories(client: SupabaseClient<Database>): IntakeRepositories {
  return {
    businessRepository: new SupabaseBusinessRepository(client),
    businessMemberRepository: new SupabaseBusinessMemberRepository(client),
    customerProfileRepository: new SupabaseCustomerProfileRepository(client),
    callRecordRepository: new SupabaseCallRecordRepository(client),
    messageRepository: new SupabaseMessageRepository(client),
    taskRepository: new SupabaseTaskRepository(client),
    auditEventRepository: new SupabaseAuditEventRepository(client),
    appointmentRepository: new SupabaseAppointmentRepository(client),
    quoteDraftRepository: new SupabaseQuoteDraftRepository(client)
  };
}
