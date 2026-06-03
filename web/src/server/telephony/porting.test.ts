import { describe, expect, it } from "vitest";

import { InMemoryBusinessRepository } from "@/server/business/bootstrap";
import { InMemoryAuditEventRepository } from "@/server/intake/auditEvents";

import { InMemoryNumberPortRequestRepository } from "./portRequests";
import { completePortForBusiness, savePortRequest, submitPortRequest } from "./porting";

async function setup() {
  const businessRepository = new InMemoryBusinessRepository();
  const numberPortRequestRepository = new InMemoryNumberPortRequestRepository();
  const auditEventRepository = new InMemoryAuditEventRepository();
  const business = await businessRepository.create({
    id: "00000000-0000-4000-8000-000000000801",
    name: "Port Detail Co",
    ownerName: "Owner",
    ownerPhone: "+12133734253",
    businessPhone: "+13105550199",
    twilioNumber: "+14155550100",
    twilioNumberSid: "PN_TRIAL",
    numberStatus: "trial",
    timezone: "America/New_York"
  });

  return {
    business,
    dependencies: {
      businessRepository,
      numberPortRequestRepository,
      auditEventRepository
    }
  };
}

describe("number porting scaffold", () => {
  it("saves porting intake, marks submitted, and completes to the ported number", async () => {
    const { business, dependencies } = await setup();

    const saved = await savePortRequest(
      {
        businessId: business.id,
        current_number_e164: "(949) 555-0100",
        current_carrier: "Current Carrier",
        account_number: "acct-123",
        account_pin: "4321",
        billing_name: "Owner Name",
        billing_address: "123 Main St",
        bill_uploaded: true
      },
      dependencies
    );
    const submitted = await submitPortRequest(business.id, dependencies);
    const completedBusiness = await completePortForBusiness(business.id, dependencies);

    expect(saved).toMatchObject({
      current_number_e164: "+19495550100",
      status: "collecting",
      bill_uploaded: true
    });
    expect(submitted.status).toBe("submitted");
    expect(completedBusiness).toMatchObject({
      twilio_number_e164: "+19495550100",
      number_status: "ported",
      number_trial_ends_at: null
    });
    expect((await dependencies.numberPortRequestRepository.findById(saved.id))?.status).toBe(
      "completed"
    );
    expect(await dependencies.auditEventRepository.list()).toHaveLength(3);
  });
});
