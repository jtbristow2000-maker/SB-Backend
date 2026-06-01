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
import { AnthropicExtractionProvider, createSandboxProviders } from "@/server/providers";
import { getAppConfig } from "@/server/config";

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
  providers: ReturnType<typeof createSandboxProviders>;
  voiceIntakeService: VoiceIntakeService;
  smsIntakeService: SmsIntakeService;
};

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
          auditEventRepository: new InMemoryAuditEventRepository()
        };
  const {
    businessRepository,
    customerProfileRepository,
    callRecordRepository,
    messageRepository,
    taskRepository,
    auditEventRepository
  } = repositories;

  await bootstrapSingleTenantBusiness(businessRepository);
  const customerProfileService = new CustomerProfileService(customerProfileRepository);
  const providers = createSandboxProviders();
  const extractionProvider =
    config.aiExtractionEnabled && config.anthropicConfigured && process.env.ANTHROPIC_API_KEY
      ? new AnthropicExtractionProvider({
          apiKey: process.env.ANTHROPIC_API_KEY
        })
      : providers.extraction;
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
    smsProvider: providers.sms,
    isSmsSendingEnabled: () => getAppConfig().smsSendingEnabled,
    isAiExtractionEnabled: () => {
      const currentConfig = getAppConfig();
      return currentConfig.aiExtractionEnabled && currentConfig.anthropicConfigured;
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
    providers,
    voiceIntakeService,
    smsIntakeService
  };

  globalForIntake.__intakeRuntime = runtime;
  return runtime;
}

export function resetIntakeRuntimeForTests(): void {
  globalForIntake.__intakeRuntime = null;
}
