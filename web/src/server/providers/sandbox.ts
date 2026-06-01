import type {
  CallProvider,
  DialTwimlInput,
  IncomingCallInput,
  InboundSmsInput,
  ProviderActionResult,
  RecordingCallbackInput,
  RecordVoicemailTwimlInput,
  SmsProvider,
  SmsSendInput,
  StorageProvider,
  StorageSaveInput,
  StorageSaveResult,
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult
} from "./types";

export type SandboxProviderLog = {
  provider: "sandbox";
  action: string;
  businessId: string;
  details: Record<string, string | number | boolean | null | undefined>;
};

export type SandboxLogger = (entry: SandboxProviderLog) => void;

function defaultLogger(entry: SandboxProviderLog): void {
  console.info("[sandbox-provider]", entry);
}

function logged(action: string): ProviderActionResult {
  return {
    provider: "sandbox",
    status: "logged",
    action,
    networkCallsMade: false
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export class SandboxSmsProvider implements SmsProvider {
  readonly providerName = "sandbox";

  constructor(private readonly logger: SandboxLogger = defaultLogger) {}

  async sendMessage(input: SmsSendInput): Promise<ProviderActionResult> {
    this.logger({
      provider: "sandbox",
      action: "sms.send.logged_only",
      businessId: input.businessId,
      details: {
        to: input.to,
        from: input.from,
        bodyLength: input.body.length
      }
    });

    return logged("sms.send.logged_only");
  }

  async recordInboundMessage(input: InboundSmsInput): Promise<ProviderActionResult> {
    this.logger({
      provider: "sandbox",
      action: "sms.inbound.logged_only",
      businessId: input.businessId,
      details: {
        from: input.from,
        to: input.to,
        bodyLength: input.body.length,
        providerMessageId: input.providerMessageId
      }
    });

    return logged("sms.inbound.logged_only");
  }
}

export class SandboxCallProvider implements CallProvider {
  readonly providerName = "sandbox";

  constructor(private readonly logger: SandboxLogger = defaultLogger) {}

  async recordIncomingCall(input: IncomingCallInput): Promise<ProviderActionResult> {
    this.logger({
      provider: "sandbox",
      action: "call.incoming.logged_only",
      businessId: input.businessId,
      details: {
        from: input.from,
        to: input.to,
        providerCallId: input.providerCallId
      }
    });

    return logged("call.incoming.logged_only");
  }

  async recordRecordingCallback(input: RecordingCallbackInput): Promise<ProviderActionResult> {
    this.logger({
      provider: "sandbox",
      action: "call.recording.logged_only",
      businessId: input.businessId,
      details: {
        providerCallId: input.providerCallId,
        recordingId: input.recordingId,
        hasRecordingUrl: Boolean(input.recordingUrl)
      }
    });

    return logged("call.recording.logged_only");
  }

  buildDialTwiml(input: DialTwimlInput): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<Response>",
      `<Dial timeout="${input.timeoutSeconds}" action="${escapeXml(input.actionUrl)}">${escapeXml(input.ownerPhoneE164)}</Dial>`,
      "</Response>"
    ].join("");
  }

  buildSayTwiml(message: string): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<Response>",
      `<Say>${escapeXml(message)}</Say>`,
      "</Response>"
    ].join("");
  }

  buildRecordVoicemailTwiml(input: RecordVoicemailTwimlInput): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<Response>",
      `<Say>${escapeXml(input.greeting)}</Say>`,
      `<Record transcribe="true" recordingStatusCallback="${escapeXml(input.recordingStatusCallbackUrl)}" recordingStatusCallbackEvent="completed" transcribeCallback="${escapeXml(input.transcribeCallbackUrl)}" maxLength="${input.maxLengthSeconds}" />`,
      "</Response>"
    ].join("");
  }

  buildEmptyTwiml(): string {
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
}

export class SandboxTranscriptionProvider implements TranscriptionProvider {
  readonly providerName = "sandbox";

  constructor(private readonly logger: SandboxLogger = defaultLogger) {}

  async transcribeRecording(input: TranscriptionInput): Promise<TranscriptionResult> {
    this.logger({
      provider: "sandbox",
      action: "transcription.logged_only",
      businessId: input.businessId,
      details: {
        recordingUrl: input.recordingUrl,
        sourceId: input.sourceId
      }
    });

    return {
      ...logged("transcription.logged_only"),
      transcript: null,
      confidence: null
    };
  }
}

export class SandboxStorageProvider implements StorageProvider {
  readonly providerName = "sandbox";

  constructor(private readonly logger: SandboxLogger = defaultLogger) {}

  async saveObject(input: StorageSaveInput): Promise<StorageSaveResult> {
    this.logger({
      provider: "sandbox",
      action: "storage.save.logged_only",
      businessId: input.businessId,
      details: {
        key: input.key,
        contentType: input.contentType,
        byteLength: input.bytes?.byteLength ?? 0
      }
    });

    return {
      ...logged("storage.save.logged_only"),
      storageUrl: `sandbox://storage/${input.businessId}/${input.key}`
    };
  }
}

export function createSandboxProviders(logger?: SandboxLogger) {
  return {
    sms: new SandboxSmsProvider(logger),
    calls: new SandboxCallProvider(logger),
    transcription: new SandboxTranscriptionProvider(logger),
    storage: new SandboxStorageProvider(logger)
  };
}
