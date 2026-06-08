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
export type TaskStatus = "open" | "done" | "completed" | "dismissed";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
export type QuoteDraftStatus = "draft" | "reviewed" | "sent" | "accepted" | "declined";
export type BusinessMemberRole = "owner" | "staff";
export type NumberStatus = "none" | "trial" | "active" | "porting" | "ported";
export type NumberPortRequestStatus = "collecting" | "submitted" | "completed" | "rejected";
export type PreferredContactMethod = "call" | "text" | "email";

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
  twilio_number_e164: string | null;
  twilio_number_sid: string | null;
  number_status: NumberStatus;
  number_trial_ends_at: string | null;
  timezone: string;
  settings_json: JsonValue;
};

export type BusinessMemberRow = {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessMemberRole;
  created_at: string;
};

export type CustomerProfileRow = TimestampColumns & {
  id: string;
  business_id: string;
  display_name: string | null;
  phone_e164: string | null;
  email: string | null;
  vehicles: string | null;
  address_line1: string | null;
  address_line2: string | null;
  po_box: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  preferred_contact: PreferredContactMethod | null;
  referral_source: string | null;
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

export type QuoteDraftRow = TimestampColumns & {
  id: string;
  business_id: string;
  customer_profile_id: string | null;
  source_call_record_id: string | null;
  service_requested: string | null;
  job_address: string | null;
  scope_notes: string | null;
  timeline: string | null;
  budget_hint: string | null;
  estimated_amount: number | null;
  status: QuoteDraftStatus;
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

export type NumberPortRequestRow = {
  id: string;
  business_id: string;
  current_number_e164: string;
  current_carrier: string | null;
  account_number: string | null;
  account_pin: string | null;
  billing_name: string | null;
  billing_address: string | null;
  loa_signed_at: string | null;
  bill_uploaded: boolean;
  status: NumberPortRequestStatus;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: BusinessRow;
        Insert: Partial<BusinessRow> & Pick<BusinessRow, "name">;
        Update: Partial<BusinessRow>;
        Relationships: [];
      };
      business_members: {
        Row: BusinessMemberRow;
        Insert: Partial<BusinessMemberRow> & Pick<BusinessMemberRow, "business_id" | "user_id">;
        Update: Partial<Pick<BusinessMemberRow, "role">>;
        Relationships: [];
      };
      customer_profiles: {
        Row: CustomerProfileRow;
        Insert: Partial<CustomerProfileRow> & Pick<CustomerProfileRow, "business_id">;
        Update: Partial<CustomerProfileRow>;
        Relationships: [];
      };
      call_records: {
        Row: CallRecordRow;
        Insert: Partial<CallRecordRow> & Pick<CallRecordRow, "business_id" | "direction" | "call_type">;
        Update: Partial<CallRecordRow>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: Partial<MessageRow> & Pick<MessageRow, "business_id" | "direction" | "channel">;
        Update: Partial<MessageRow>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: Partial<TaskRow> & Pick<TaskRow, "business_id" | "task_type" | "title">;
        Update: Partial<TaskRow>;
        Relationships: [];
      };
      appointments: {
        Row: AppointmentRow;
        Insert: Partial<AppointmentRow> & Pick<AppointmentRow, "business_id" | "title" | "scheduled_start_at">;
        Update: Partial<AppointmentRow>;
        Relationships: [];
      };
      quote_drafts: {
        Row: QuoteDraftRow;
        Insert: Partial<QuoteDraftRow> & Pick<QuoteDraftRow, "business_id">;
        Update: Partial<QuoteDraftRow>;
        Relationships: [];
      };
      audit_events: {
        Row: AuditEventRow;
        Insert: Partial<AuditEventRow> & Pick<AuditEventRow, "business_id" | "actor" | "event_type">;
        Update: never;
        Relationships: [];
      };
      number_port_requests: {
        Row: NumberPortRequestRow;
        Insert: Partial<NumberPortRequestRow> & Pick<NumberPortRequestRow, "business_id" | "current_number_e164">;
        Update: Partial<NumberPortRequestRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
