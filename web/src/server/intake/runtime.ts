import {
  bootstrapSingleTenantBusiness,
  InMemoryBusinessRepository
} from "@/server/business/bootstrap";
import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { CustomerProfileService } from "@/server/customerProfiles/service";
import { createSandboxProviders } from "@/server/providers";

import { InMemoryAuditEventRepository } from "./auditEvents";
import { InMemoryCallRecordRepository } from "./callRecords";
import { InMemoryTaskRepository } from "./tasks";
import { VoiceIntakeService } from "./voice";

type IntakeRuntime = {
  businessRepository: InMemoryBusinessRepository;
  customerProfileRepository: InMemoryCustomerProfileRepository;
  customerProfileService: CustomerProfileService;
  callRecordRepository: InMemoryCallRecordRepository;
  taskRepository: InMemoryTaskRepository;
  auditEventRepository: InMemoryAuditEventRepository;
  providers: ReturnType<typeof createSandboxProviders>;
  voiceIntakeService: VoiceIntakeService;
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
  const taskRepository = new InMemoryTaskRepository();
  const auditEventRepository = new InMemoryAuditEventRepository();
  const providers = createSandboxProviders();
  const voiceIntakeService = new VoiceIntakeService({
    businessRepository,
    customerProfileService,
    callRecordRepository,
    taskRepository,
    auditEventRepository,
    callProvider: providers.calls
  });

  runtime = {
    businessRepository,
    customerProfileRepository,
    customerProfileService,
    callRecordRepository,
    taskRepository,
    auditEventRepository,
    providers,
    voiceIntakeService
  };

  return runtime;
}

export function resetIntakeRuntimeForTests(): void {
  runtime = null;
}
