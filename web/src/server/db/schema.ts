export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type Direction = "inbound" | "outbound";
export type CallType = "missed" | "answered" | "voicemail" | "live" | "manual";
export type MessageChannel = "sms" | "mms" | "email" | "web";
export type TaskStatus = "open" | "completed" | "dismissed";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

export const BACKEND_02_TABLES = [
  "businesses",
  "customer_profiles",
  "call_records",
  "messages",
  "tasks"
] as const;

export type Backend02Table = (typeof BACKEND_02_TABLES)[number];

export const BACKEND_03_TABLES = [...BACKEND_02_TABLES, "appointments"] as const;

export type Backend03Table = (typeof BACKEND_03_TABLES)[number];

export type TimestampColumns = {
  created_at: string;
  updated_at: string;
};

export type BusinessRow = TimestampColumns & {
  id: string;
  name: string;
  owner_name: string | null;
  owner_phone_e164: string | null;
  business_phone_e164: string | null;
  timezone: string;
  settings_json: JsonValue;
};

export type CustomerProfileRow = TimestampColumns & {
  id: string;
  business_id: string;
  display_name: string | null;
  phone_e164: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  source: string | null;
  status: string;
  summary: string | null;
  notes: string | null;
  last_contact_at: string | null;
};

export type CallRecordRow = TimestampColumns & {
  id: string;
  business_id: string;
  customer_profile_id: string | null;
  provider: string;
  provider_call_id: string | null;
  direction: Direction;
  call_type: CallType;
  from_phone_e164: string | null;
  to_phone_e164: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  ai_summary: string | null;
  extracted_json: JsonValue;
  needs_review: boolean;
};

export type MessageRow = {
  id: string;
  business_id: string;
  customer_profile_id: string | null;
  provider: string;
  provider_message_id: string | null;
  direction: Direction;
  channel: MessageChannel;
  from_phone_e164: string | null;
  to_phone_e164: string | null;
  body: string | null;
  media_json: JsonValue;
  status: string;
  sent_at: string | null;
  created_at: string;
};

export type TaskRow = TimestampColumns & {
  id: string;
  business_id: string;
  customer_profile_id: string | null;
  task_type: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  status: TaskStatus;
};

export type AppointmentRow = TimestampColumns & {
  id: string;
  business_id: string;
  customer_profile_id: string | null;
  source_call_record_id: string | null;
  title: string;
  service_requested: string | null;
  scheduled_start_at: string;
  scheduled_end_at: string | null;
  timezone: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
};

export type AuditActor = "system" | "owner" | "provider";

export type AuditEventRow = {
  id: string;
  business_id: string;
  customer_profile_id: string | null;
  actor: AuditActor;
  event_type: string;
  event_json: JsonValue;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: BusinessRow;
        Insert: Omit<Partial<BusinessRow>, "id" | "created_at" | "updated_at"> & Pick<BusinessRow, "name">;
        Update: Partial<Omit<BusinessRow, "id" | "created_at">>;
      };
      customer_profiles: {
        Row: CustomerProfileRow;
        Insert: Omit<Partial<CustomerProfileRow>, "id" | "created_at" | "updated_at"> &
          Pick<CustomerProfileRow, "business_id">;
        Update: Partial<Omit<CustomerProfileRow, "id" | "business_id" | "created_at">>;
      };
      call_records: {
        Row: CallRecordRow;
        Insert: Omit<Partial<CallRecordRow>, "id" | "created_at" | "updated_at"> &
          Pick<CallRecordRow, "business_id" | "direction" | "call_type">;
        Update: Partial<Omit<CallRecordRow, "id" | "business_id" | "created_at">>;
      };
      messages: {
        Row: MessageRow;
        Insert: Omit<Partial<MessageRow>, "id" | "created_at"> &
          Pick<MessageRow, "business_id" | "direction" | "channel">;
        Update: Partial<Omit<MessageRow, "id" | "business_id" | "created_at">>;
      };
      tasks: {
        Row: TaskRow;
        Insert: Omit<Partial<TaskRow>, "id" | "created_at" | "updated_at"> &
          Pick<TaskRow, "business_id" | "task_type" | "title">;
        Update: Partial<Omit<TaskRow, "id" | "business_id" | "created_at">>;
      };
      appointments: {
        Row: AppointmentRow;
        Insert: Omit<Partial<AppointmentRow>, "id" | "created_at" | "updated_at"> &
          Pick<AppointmentRow, "business_id" | "title" | "scheduled_start_at">;
        Update: Partial<Omit<AppointmentRow, "id" | "business_id" | "created_at">>;
      };
      audit_events: {
        Row: AuditEventRow;
        Insert: Omit<Partial<AuditEventRow>, "id" | "created_at"> &
          Pick<AuditEventRow, "business_id" | "actor" | "event_type">;
        Update: never;
      };
    };
  };
};
