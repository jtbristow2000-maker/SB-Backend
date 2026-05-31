import {
  bootstrapSingleTenantBusiness,
  InMemoryBusinessRepository
} from "@/server/business/bootstrap";
import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { CustomerProfileService } from "@/server/customerProfiles/service";
import { createSandboxProviders } from "@/server/providers";
import { getAppConfig } from "@/server/config";

import { InMemoryAuditEventRepository } from "./auditEvents";
import { InMemoryCallRecordRepository } from "./callRecords";
import { InMemoryMessageRepository } from "./messages";
import { SmsIntakeService } from "./sms";
import { InMemoryTaskRepository } from "./tasks";
import { VoiceIntakeService } from "./voice";

type IntakeRuntime = {
  businessRepository: InMemoryBusinessRepository;
  customerProfileRepository: InMemoryCustomerProfileRepository;
  customerProfileService: CustomerProfileService;
  callRecordRepository: InMemoryCallRecordRepository;
  messageRepository: InMemoryMessageRepository;
  taskRepository: InMemoryTaskRepository;
  auditEventRepository: InMemoryAuditEventRepository;
  providers: ReturnType<typeof createSandboxProviders>;
  voiceIntakeService: VoiceIntakeService;
  smsIntakeService: SmsIntakeService;
};

let runtime: IntakeRuntime | null = null;

export async function getIntakeRuntime(): Promise<IntakeRuntime> {
  if (runtime) {
    return runtime;
  }

  const businessRepository = new InMemoryBusinessRepository();
  await bootstrapSingleTenantBusiness(businessRepository);
  const customerProfileRepository = new InMemoryCustomerProfileRepository();
  const customerProfileService = new CustomerProfileService(customerProfileRepository);
  const callRecordRepository = new InMemoryCallRecordRepository();
  const messageRepository = new InMemoryMessageRepository();
  const taskRepository = new InMemoryTaskRepository();
  const auditEventRepository = new InMemoryAuditEventRepository();
  const providers = createSandboxProviders();
  const voiceIntakeService = new VoiceIntakeService({
    businessRepository,
    customerProfileService,
    callRecordRepository,
    messageRepository,
    taskRepository,
    auditEventRepository,
    callProvider: providers.calls,
    smsProvider: providers.sms,
    isSmsSendingEnabled: () => getAppConfig().smsSendingEnabled
  });
  const smsIntakeService = new SmsIntakeService({
    businessRepository,
    customerProfileService,
    messageRepository,
    taskRepository
  });

  runtime = {
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

  return runtime;
}

export function resetIntakeRuntimeForTests(): void {
  runtime = null;
}
