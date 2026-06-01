import {
  type BusinessRepository,
  bootstrapSingleTenantBusiness,
  InMemoryBusinessRepository
} from "@/server/business/bootstrap";
import {
  type CustomerProfileRepository,
  InMemoryCustomerProfileRepository
} from "@/server/customerProfiles/repository";
import { CustomerProfileService } from "@/server/customerProfiles/service";
import { createSupabaseRepositories } from "@/server/db/supabaseRepositories";
import { getSupabaseServerClient } from "@/server/db/supabaseClient";
import {
  AnthropicExtractionProvider,
  createSandboxProviders,
  type ExtractionProvider,
  OpenAIExtractionProvider,
  OpenAITranscriptionProvider,
  type SmsProvider,
  TwilioSmsProvider
} from "@/server/providers";
import { type AppConfig, getAppConfig } from "@/server/config";

import { type AppointmentRepository, InMemoryAppointmentRepository } from "./appointments";
import { type AuditEventRepository, InMemoryAuditEventRepository } from "./auditEvents";
import { type CallRecordRepository, InMemoryCallRecordRepository } from "./callRecords";
import { type MessageRepository, InMemoryMessageRepository } from "./messages";
import { SmsIntakeService } from "./sms";
import { type TaskRepository, InMemoryTaskRepository } from "./tasks";
import { VoiceIntakeService } from "./voice";

type IntakeRuntime = {
  businessRepository: BusinessRepository;
  customerProfileRepository: CustomerProfileRepository;
  customerProfileService: CustomerProfileService;
  callRecordRepository: CallRecordRepository;
  messageRepository: MessageRepository;
  taskRepository: TaskRepository;
  auditEventRepository: AuditEventRepository;
  appointmentRepository: AppointmentRepository;
  providers: ReturnType<typeof createSandboxProviders>;
  smsProvider: SmsProvider;
  voiceIntakeService: VoiceIntakeService;
  smsIntakeService: SmsIntakeService;
};

type ExtractionRuntimeConfig = Pick<
  AppConfig,
  "aiExtractionEnabled" | "anthropicConfigured" | "openAiConfigured"
>;

// Cache the runtime on globalThis, not a plain module `let`. Next.js dev (and
// route handlers / server actions) can evaluate this module in more than one
// bundle, so a module-scoped singleton gets duplicated — which made one route's
// mutations invisible to another (and would break owner action buttons). A
// process-global handle guarantees every caller shares ONE in-memory runtime.
const globalForIntake = globalThis as unknown as {
  __intakeRuntime?: IntakeRuntime | null;
};

export async function getIntakeRuntime(): Promise<IntakeRuntime> {
  if (globalForIntake.__intakeRuntime) {
    return globalForIntake.__intakeRuntime;
  }

  const config = getAppConfig();
  const repositories =
    config.persistence === "supabase"
      ? createSupabaseRepositories(getSupabaseServerClient())
      : {
          businessRepository: new InMemoryBusinessRepository(),
          customerProfileRepository: new InMemoryCustomerProfileRepository(),
          callRecordRepository: new InMemoryCallRecordRepository(),
          messageRepository: new InMemoryMessageRepository(),
          taskRepository: new InMemoryTaskRepository(),
          auditEventRepository: new InMemoryAuditEventRepository(),
          appointmentRepository: new InMemoryAppointmentRepository()
        };
  const {
    businessRepository,
    customerProfileRepository,
    callRecordRepository,
    messageRepository,
    taskRepository,
    auditEventRepository,
    appointmentRepository
  } = repositories;

  await bootstrapSingleTenantBusiness(businessRepository);
  const customerProfileService = new CustomerProfileService(customerProfileRepository);
  const providers = createSandboxProviders();
  const smsProvider = selectSmsProvider(config, providers.sms);
  const transcriptionProvider =
    config.fastTranscriptionEnabled && config.openAiConfigured && process.env.OPENAI_API_KEY
      ? new OpenAITranscriptionProvider({
          apiKey: process.env.OPENAI_API_KEY,
          twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
          twilioAuthToken: process.env.TWILIO_AUTH_TOKEN
        })
      : providers.transcription;
  const extractionProvider = selectExtractionProvider(config, providers.extraction);
  const voiceIntakeService = new VoiceIntakeService({
    businessRepository,
    customerProfileRepository,
    customerProfileService,
    callRecordRepository,
    messageRepository,
    taskRepository,
    auditEventRepository,
    callProvider: providers.calls,
    extractionProvider,
    transcriptionProvider,
    smsProvider,
    isSmsSendingEnabled: () => getAppConfig().smsSendingEnabled,
    isAiExtractionEnabled: () => {
      return hasConfiguredExtractionProvider(getAppConfig());
    },
    isFastTranscriptionEnabled: () => {
      const currentConfig = getAppConfig();
      return currentConfig.fastTranscriptionEnabled && currentConfig.openAiConfigured;
    }
  });
  const smsIntakeService = new SmsIntakeService({
    businessRepository,
    customerProfileService,
    messageRepository,
    taskRepository
  });

  const runtime: IntakeRuntime = {
    businessRepository,
    customerProfileRepository,
    customerProfileService,
    callRecordRepository,
    messageRepository,
    taskRepository,
    auditEventRepository,
    appointmentRepository,
    providers,
    smsProvider,
    voiceIntakeService,
    smsIntakeService
  };

  globalForIntake.__intakeRuntime = runtime;
  return runtime;
}

export function resetIntakeRuntimeForTests(): void {
  globalForIntake.__intakeRuntime = null;
}

export function selectSmsProvider(
  config: Pick<AppConfig, "twilioConfigured" | "realMessageSendingEnabled">,
  sandboxProvider: SmsProvider,
  env: NodeJS.ProcessEnv = process.env
): SmsProvider {
  if (
    config.twilioConfigured &&
    config.realMessageSendingEnabled &&
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN
  ) {
    return new TwilioSmsProvider({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      fromNumber: env.TWILIO_PHONE_NUMBER ?? env.BUSINESS_PHONE
    });
  }
  return sandboxProvider;
}

export function selectExtractionProvider(
  config: ExtractionRuntimeConfig,
  sandboxProvider: ExtractionProvider,
  env: NodeJS.ProcessEnv = process.env
): ExtractionProvider {
  if (!config.aiExtractionEnabled) {
    return sandboxProvider;
  }

  const requestedProvider = parseExtractionProvider(env.EXTRACTION_PROVIDER);
  if (requestedProvider === "openai") {
    return config.openAiConfigured && env.OPENAI_API_KEY
      ? new OpenAIExtractionProvider({ apiKey: env.OPENAI_API_KEY })
      : sandboxProvider;
  }

  if (requestedProvider === "anthropic") {
    return config.anthropicConfigured && env.ANTHROPIC_API_KEY
      ? new AnthropicExtractionProvider({ apiKey: env.ANTHROPIC_API_KEY })
      : sandboxProvider;
  }

  if (config.anthropicConfigured && env.ANTHROPIC_API_KEY) {
    return new AnthropicExtractionProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }

  if (config.openAiConfigured && env.OPENAI_API_KEY) {
    return new OpenAIExtractionProvider({ apiKey: env.OPENAI_API_KEY });
  }

  return sandboxProvider;
}

export function hasConfiguredExtractionProvider(
  config: ExtractionRuntimeConfig,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!config.aiExtractionEnabled) {
    return false;
  }

  const requestedProvider = parseExtractionProvider(env.EXTRACTION_PROVIDER);
  if (requestedProvider === "openai") {
    return Boolean(config.openAiConfigured && env.OPENAI_API_KEY);
  }

  if (requestedProvider === "anthropic") {
    return Boolean(config.anthropicConfigured && env.ANTHROPIC_API_KEY);
  }

  return Boolean(
    (config.anthropicConfigured && env.ANTHROPIC_API_KEY) ||
      (config.openAiConfigured && env.OPENAI_API_KEY)
  );
}

function parseExtractionProvider(value?: string): "openai" | "anthropic" | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "openai" || normalized === "anthropic" ? normalized : null;
}
