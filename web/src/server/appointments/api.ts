import type { BusinessRow, AppointmentRow, AppointmentStatus } from "@/server/db/schema";
import type {
  AppointmentCreateInput,
  AppointmentRepository,
  AppointmentUpdateInput
} from "@/server/intake/appointments";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import type { CustomerProfileRepository } from "@/server/customerProfiles/repository";

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show"
];

const CREATE_FIELDS = new Set([
  "customer_profile_id",
  "source_call_record_id",
  "title",
  "service_requested",
  "scheduled_start_at",
  "scheduled_end_at",
  "timezone",
  "status",
  "location",
  "notes"
]);

const UPDATE_FIELDS = new Set([
  "customer_profile_id",
  "source_call_record_id",
  "title",
  "service_requested",
  "scheduled_start_at",
  "scheduled_end_at",
  "timezone",
  "status",
  "location",
  "notes"
]);

type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; fields?: string[] };

export type AppointmentApiDependencies = {
  appointmentRepository: AppointmentRepository;
  customerProfileRepository: CustomerProfileRepository;
  auditEventRepository: AuditEventRepository;
};

export function listBusinessAppointments(
  appointments: AppointmentRow[],
  business: BusinessRow,
  filters: { from?: string | null; to?: string | null }
): AppointmentRow[] {
  const from = parseOptionalDate(filters.from);
  const to = parseOptionalDate(filters.to);

  return appointments
    .filter((appointment) => appointment.business_id === business.id)
    .filter((appointment) => {
      const start = Date.parse(appointment.scheduled_start_at);
      if (!Number.isFinite(start)) {
        return false;
      }
      return (from === null || start >= from) && (to === null || start <= to);
    })
    .sort((a, b) => a.scheduled_start_at.localeCompare(b.scheduled_start_at));
}

export function validateAppointmentCreatePayload(
  payload: unknown,
  business: BusinessRow
): Validation<AppointmentCreateInput> {
  const object = readObjectPayload(payload, CREATE_FIELDS, "unknown_appointment_create_fields");
  if (!object.ok) {
    return object;
  }

  const title = readRequiredString(object.value.title);
  const scheduledStartAt = readRequiredDate(object.value.scheduled_start_at);
  const status = readOptionalStatus(object.value.status);
  if (!title || !scheduledStartAt || status === false) {
    const fields = [
      !title ? "title" : null,
      !scheduledStartAt ? "scheduled_start_at" : null,
      status === false ? "status" : null
    ].filter((field): field is string => Boolean(field));
    return { ok: false, status: 400, error: "invalid_appointment_field_values", fields };
  }

  const scheduledEndAt = readOptionalDateString(object.value.scheduled_end_at);
  if (scheduledEndAt === false) {
    return {
      ok: false,
      status: 400,
      error: "invalid_appointment_field_values",
      fields: ["scheduled_end_at"]
    };
  }

  return {
    ok: true,
    value: {
      business_id: business.id,
      customer_profile_id: readOptionalString(object.value.customer_profile_id),
      source_call_record_id: readOptionalString(object.value.source_call_record_id),
      title,
      service_requested: readOptionalString(object.value.service_requested),
      scheduled_start_at: scheduledStartAt,
      scheduled_end_at: scheduledEndAt,
      timezone: readOptionalString(object.value.timezone) ?? business.timezone,
      status: status ?? "scheduled",
      location: readOptionalString(object.value.location),
      notes: readOptionalString(object.value.notes)
    }
  };
}

export function validateAppointmentUpdatePayload(
  payload: unknown
): Validation<AppointmentUpdateInput> {
  const object = readObjectPayload(payload, UPDATE_FIELDS, "unknown_appointment_update_fields");
  if (!object.ok) {
    return object;
  }

  const update: AppointmentUpdateInput = {};
  for (const [field, value] of Object.entries(object.value)) {
    if (field === "status") {
      const status = readOptionalStatus(value);
      if (status === false || status === null) {
        return {
          ok: false,
          status: 400,
          error: "invalid_appointment_field_values",
          fields: ["status"]
        };
      }
      update.status = status;
      continue;
    }

    if (field === "scheduled_start_at" || field === "scheduled_end_at") {
      const date = field === "scheduled_start_at" ? readRequiredDate(value) : readOptionalDateString(value);
      if (!date) {
        return {
          ok: false,
          status: 400,
          error: "invalid_appointment_field_values",
          fields: [field]
        };
      }
      update[field] = date;
      continue;
    }

    if (field === "title") {
      const title = readRequiredString(value);
      if (!title) {
        return {
          ok: false,
          status: 400,
          error: "invalid_appointment_field_values",
          fields: ["title"]
        };
      }
      update.title = title;
      continue;
    }

    if (field === "timezone") {
      const timezone = readRequiredString(value);
      if (!timezone) {
        return {
          ok: false,
          status: 400,
          error: "invalid_appointment_field_values",
          fields: ["timezone"]
        };
      }
      update.timezone = timezone;
      continue;
    }

    const text = readOptionalString(value);
    if (
      field === "customer_profile_id" ||
      field === "source_call_record_id" ||
      field === "service_requested" ||
      field === "location" ||
      field === "notes"
    ) {
      update[field] = text;
    }
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, status: 400, error: "empty_appointment_update" };
  }

  return { ok: true, value: update };
}

export async function createBusinessAppointment(
  dependencies: AppointmentApiDependencies,
  business: BusinessRow,
  input: AppointmentCreateInput
): Promise<Validation<AppointmentRow>> {
  const profileError = await validateProfileScope(
    dependencies.customerProfileRepository,
    business.id,
    input.customer_profile_id
  );
  if (profileError) {
    return profileError;
  }

  const appointment = await dependencies.appointmentRepository.create(input);
  await dependencies.auditEventRepository.create({
    business_id: business.id,
    customer_profile_id: appointment.customer_profile_id,
    actor: "owner",
    event_type: "appointment.created",
    event_json: { appointmentId: appointment.id }
  });
  return { ok: true, value: appointment };
}

export async function updateBusinessAppointment(
  dependencies: AppointmentApiDependencies,
  business: BusinessRow,
  appointmentId: string,
  input: AppointmentUpdateInput
): Promise<Validation<AppointmentRow>> {
  const existing = await dependencies.appointmentRepository.findById(appointmentId);
  if (!existing || existing.business_id !== business.id) {
    return { ok: false, status: 404, error: "appointment_not_found" };
  }

  const profileError = await validateProfileScope(
    dependencies.customerProfileRepository,
    business.id,
    input.customer_profile_id
  );
  if (profileError) {
    return profileError;
  }

  const appointment = await dependencies.appointmentRepository.update(appointmentId, input);
  await dependencies.auditEventRepository.create({
    business_id: business.id,
    customer_profile_id: appointment.customer_profile_id,
    actor: "owner",
    event_type: "appointment.updated",
    event_json: {
      appointmentId: appointment.id,
      fields: Object.keys(input)
    }
  });
  return { ok: true, value: appointment };
}

export async function deleteBusinessAppointment(
  dependencies: AppointmentApiDependencies,
  business: BusinessRow,
  appointmentId: string
): Promise<Validation<{ id: string }>> {
  const existing = await dependencies.appointmentRepository.findById(appointmentId);
  if (!existing || existing.business_id !== business.id) {
    return { ok: false, status: 404, error: "appointment_not_found" };
  }

  await dependencies.appointmentRepository.delete(appointmentId);
  await dependencies.auditEventRepository.create({
    business_id: business.id,
    customer_profile_id: existing.customer_profile_id,
    actor: "owner",
    event_type: "appointment.deleted",
    event_json: { appointmentId }
  });
  return { ok: true, value: { id: appointmentId } };
}

function readObjectPayload(
  payload: unknown,
  allowedFields: Set<string>,
  unknownFieldsError: string
): Validation<Record<string, unknown>> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, status: 400, error: "invalid_appointment_payload" };
  }

  const record = payload as Record<string, unknown>;
  const unknownFields = Object.keys(record).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    return {
      ok: false,
      status: 400,
      error: unknownFieldsError,
      fields: unknownFields
    };
  }

  return { ok: true, value: record };
}

function readRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRequiredDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readOptionalDateString(value: unknown): string | null | false {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return readRequiredDate(value) ?? false;
}

function readOptionalStatus(value: unknown): AppointmentStatus | null | false {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return typeof value === "string" && APPOINTMENT_STATUSES.includes(value as AppointmentStatus)
    ? (value as AppointmentStatus)
    : false;
}

function parseOptionalDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function validateProfileScope(
  repository: CustomerProfileRepository,
  businessId: string,
  profileId: string | null | undefined
): Promise<Validation<never> | null> {
  if (!profileId) {
    return null;
  }

  const profiles = await repository.list();
  const profile = profiles.find(
    (candidate) => candidate.id === profileId && candidate.business_id === businessId
  );
  return profile ? null : { ok: false, status: 404, error: "profile_not_found" };
}
