import { describe, expect, it } from "vitest";

import { InMemoryBusinessRepository } from "@/server/business/bootstrap";

import { resolveBusinessByInboundPhone } from "./routing";

describe("inbound business phone routing", () => {
  it("matches a business-owned Twilio number before falling back to the bootstrap phone", async () => {
    const repository = new InMemoryBusinessRepository();
    const business = await repository.create({
      id: "00000000-0000-4000-8000-000000000901",
      name: "Routing Detail Co",
      ownerName: "Owner",
      ownerPhone: "+12133734253",
      businessPhone: "+13105550199",
      timezone: "America/New_York"
    });
    await repository.updateTelephony(business.id, {
      twilioNumber: "+14155550100",
      twilioNumberSid: "PN_ROUTE",
      numberStatus: "trial"
    });

    await expect(resolveBusinessByInboundPhone(repository, "+14155550100")).resolves.toMatchObject({
      business: { id: business.id },
      matchedBy: "twilio_number"
    });
    await expect(resolveBusinessByInboundPhone(repository, "+13105550199")).resolves.toMatchObject({
      business: { id: business.id },
      matchedBy: "business_phone"
    });
  });
});
