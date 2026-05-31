import { describe, expect, it } from "vitest";

import { bootstrapSingleTenantBusiness, InMemoryBusinessRepository } from "@/server/business/bootstrap";
import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { CustomerProfileService } from "@/server/customerProfiles/service";

import { InMemoryMessageRepository } from "./messages";
import { SmsIntakeService } from "./sms";
import { InMemoryTaskRepository } from "./tasks";

describe("BACKEND-11 inbound SMS intake service", () => {
  async function setupService() {
    const businessRepository = new InMemoryBusinessRepository();
    await bootstrapSingleTenantBusiness(businessRepository, {
      id: "00000000-0000-4000-8000-000000000401",
      name: "SMS Detail Co",
      ownerName: "Owner",
      ownerPhone: "(213) 373-4253",
      businessPhone: "(310) 555-0199",
      timezone: "America/New_York"
    });
    const customerProfileRepository = new InMemoryCustomerProfileRepository();
    const customerProfileService = new CustomerProfileService(customerProfileRepository);
    const messageRepository = new InMemoryMessageRepository();
    const taskRepository = new InMemoryTaskRepository();
    const service = new SmsIntakeService({
      businessRepository,
      customerProfileService,
      messageRepository,
      taskRepository
    });

    return {
      customerProfileRepository,
      messageRepository,
      taskRepository,
      service
    };
  }

  it("creates one profile and threads repeated inbound SMS onto it", async () => {
    const { customerProfileRepository, messageRepository, service } = await setupService();

    const first = await service.handleInboundSms({
      from: "(949) 555-0100",
      to: "+13105550199",
      body: "Need a quote",
      messageSid: "SM_1"
    });
    const second = await service.handleInboundSms({
      from: "+1 949 555 0100",
      to: "+13105550199",
      body: "Can you come Friday?",
      messageSid: "SM_2"
    });

    const profiles = await customerProfileRepository.list();
    const messages = await messageRepository.list();
    expect(first.status).toBe("stored");
    expect(second.status).toBe("stored");
    expect(profiles).toHaveLength(1);
    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.customer_profile_id)).toEqual([
      profiles[0].id,
      profiles[0].id
    ]);
    expect(profiles[0].last_contact_at).not.toBeNull();
  });

  it("flags an open callback task when the customer replies", async () => {
    const { customerProfileRepository, taskRepository, service } = await setupService();
    const first = await service.handleInboundSms({
      from: "(949) 555-0100",
      to: "+13105550199",
      body: "Need a quote",
      messageSid: "SM_1"
    });
    await taskRepository.create({
      business_id: "00000000-0000-4000-8000-000000000401",
      customer_profile_id: first.customerProfileId,
      task_type: "callback",
      title: "Call back missed caller",
      status: "open"
    });

    const second = await service.handleInboundSms({
      from: "+19495550100",
      to: "+13105550199",
      body: "Following up",
      messageSid: "SM_2"
    });

    const tasks = await taskRepository.list();
    expect(await customerProfileRepository.list()).toHaveLength(1);
    expect(second.flaggedTask?.id).toBe(tasks[0].id);
    expect(tasks[0].notes).toContain("Customer replied by SMS.");
  });
});
