export type ProviderActionStatus = "logged" | "skipped";

export type ProviderActionResult = {
  provider: string;
  status: ProviderActionStatus;
  action: string;
  networkCallsMade: false;
};

export type SmsSendInput = {
  businessId: string;
  to: string;
  from?: string;
  body: string;
};

export type InboundSmsInput = {
  businessId: string;
  from: string;
  to: string;
  body: string;
  providerMessageId?: string;
};

export interface SmsProvider {
  readonly providerName: string;
  sendMessage(input: SmsSendInput): Promise<ProviderActionResult>;
  recordInboundMessage(input: InboundSmsInput): Promise<ProviderActionResult>;
}

export type IncomingCallInput = {
  businessId: string;
  from: string;
  to: string;
  providerCallId?: string;
};

export type RecordingCallbackInput = {
  businessId: string;
  providerCallId?: string;
  recordingUrl?: string;
  recordingId?: string;
};

export interface CallProvider {
  readonly providerName: string;
  recordIncomingCall(input: IncomingCallInput): Promise<ProviderActionResult>;
  recordRecordingCallback(input: RecordingCallbackInput): Promise<ProviderActionResult>;
  buildDialTwiml(input: DialTwimlInput): string;
  buildRecordVoicemailTwiml(input: RecordVoicemailTwimlInput): string;
  buildSayTwiml(message: string): string;
  buildEmptyTwiml(): string;
}

export type DialTwimlInput = {
  ownerPhoneE164: string;
  actionUrl: string;
  timeoutSeconds: number;
};

export type RecordVoicemailTwimlInput = {
  greeting: string;
  recordingStatusCallbackUrl: string;
  transcribeCallbackUrl: string;
  maxLengthSeconds: number;
};

export type TranscriptionInput = {
  businessId: string;
  recordingUrl: string;
  sourceId?: string;
};

export type TranscriptionResult = ProviderActionResult & {
  transcript: null;
  confidence: null;
};

export interface TranscriptionProvider {
  readonly providerName: string;
  transcribeRecording(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export type StorageSaveInput = {
  businessId: string;
  key: string;
  contentType?: string;
  bytes?: Uint8Array;
};

export type StorageSaveResult = ProviderActionResult & {
  storageUrl: string;
};

export interface StorageProvider {
  readonly providerName: string;
  saveObject(input: StorageSaveInput): Promise<StorageSaveResult>;
}

export type VoicemailExtractionInput = {
  businessId: string;
  callRecordId: string;
  customerProfileId?: string | null;
  transcript: string;
  timezone?: string | null;
};

export type VoicemailExtractionResult = {
  caller_name: string | null;
  requested_datetime: string | null;
  service_requested: string | null;
  summary: string | null;
};

export interface ExtractionProvider {
  readonly providerName: string;
  extractVoicemailDetails(
    input: VoicemailExtractionInput
  ): Promise<VoicemailExtractionResult | null>;
}
