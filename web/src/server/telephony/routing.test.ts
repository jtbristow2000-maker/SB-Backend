import { describe, expect, it } from "vitest";

import { InMemoryBusinessRepository } from "@/server/business/bootstrap";
import { InMemoryAuditEventRepository } from "@/server/intake/auditEvents";

import {
  resolveBusinessByInboundPhone,
  resolveBusinessForIncomingVoice,
  resolveOutboundNumber
} from "./routing";

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

  it("routes shared-number forwarded calls by ForwardedFrom", async () => {
    const repository = new InMemoryBusinessRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    const business = await repository.create({
      id: "00000000-0000-4000-8000-000000000902",
      name: "Shared Forward Co",
      ownerName: "Owner",
      ownerPhone: "+12133734253",
      businessPhone: "+13105550199",
      timezone: "America/New_York"
    });

    const match = await resolveBusinessForIncomingVoice({
      businessRepository: repository,
      auditEventRepository,
      toE164: "+18664819747",
      forwardedFrom: "(310) 555-0199",
      sharedNumberE164: "+18664819747"
    });

    expect(match).toMatchObject({
      business: { id: business.id },
      matchedBy: "shared_forward"
    });
    expect(await auditEventRepository.list()).toHaveLength(0);
  });

  it("uses CalledVia as the shared-number forwarding fallback", async () => {
    const repository = new InMemoryBusinessRepository();
    const business = await repository.create({
      id: "00000000-0000-4000-8000-000000000903",
      name: "CalledVia Co",
      ownerName: "Owner",
      ownerPhone: "+12133734253",
      businessPhone: "+13105550188",
      timezone: "America/New_York"
    });

    const match = await resolveBusinessForIncomingVoice({
      businessRepository: repository,
      toE164: "+18664819747",
      calledVia: "+13105550188",
      sharedNumberE164: "+18664819747"
    });

    expect(match).toMatchObject({
      business: { id: business.id },
      matchedBy: "shared_forward"
    });
  });

  it("returns no match for shared-number calls missing forwarding fields", async () => {
    const repository = new InMemoryBusinessRepository();
    await repository.create({
      id: "00000000-0000-4000-8000-000000000904",
      name: "Missing Forward Co",
      ownerName: "Owner",
      ownerPhone: "+12133734253",
      businessPhone: "+13105550199",
      timezone: "America/New_York"
    });

    const match = await resolveBusinessForIncomingVoice({
      businessRepository: repository,
      toE164: "+18664819747",
      sharedNumberE164: "+18664819747"
    });

    expect(match).toBeNull();
  });

  it("returns no match for shared-number calls with an unmatched forwarded number", async () => {
    const repository = new InMemoryBusinessRepository();
    await repository.create({
      id: "00000000-0000-4000-8000-000000000905",
      name: "Unmatched Forward Co",
      ownerName: "Owner",
      ownerPhone: "+12133734253",
      businessPhone: "+13105550199",
      timezone: "America/New_York"
    });

    const match = await resolveBusinessForIncomingVoice({
      businessRepository: repository,
      toE164: "+18664819747",
      forwardedFrom: "+13105550999",
      sharedNumberE164: "+18664819747"
    });

    expect(match).toBeNull();
  });

  it("audits business-phone collisions and selects the most recently updated business", async () => {
    const repository = new InMemoryBusinessRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    await repository.create({
      id: "00000000-0000-4000-8000-000000000906",
      name: "Older Duplicate Co",
      ownerName: "Owner",
      ownerPhone: "+12133734253",
      businessPhone: "+13105550199",
      timezone: "America/New_York"
    });
    const newer = await repository.create({
      id: "00000000-0000-4000-8000-000000000907",
      name: "Newer Duplicate Co",
      ownerName: "Owner",
      ownerPhone: "+12133734254",
      businessPhone: "+13105550199",
      timezone: "America/New_York"
    });
    await repository.updateSettings(newer.id, { brand_color: "#123456" });

    const match = await resolveBusinessByInboundPhone(repository, "+13105550199", {
      auditEventRepository,
      collisionRoute: "test"
    });
    const audits = await auditEventRepository.list();

    expect(match?.business.id).toBe(newer.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      business_id: newer.id,
      event_type: "business_phone.collision",
      event_json: {
        phoneE164: "+13105550199",
        route: "test"
      }
    });
  });

  it("resolves outbound numbers as dedicated first, then shared, then none", async () => {
    expect(
      resolveOutboundNumber(
        { twilio_number_e164: "+14155550100" },
        { sharedNumberE164: "+18664819747" }
      )
    ).toBe("+14155550100");
    expect(resolveOutboundNumber({ twilio_number_e164: null }, { sharedNumberE164: "+18664819747" })).toBe(
      "+18664819747"
    );
    expect(resolveOutboundNumber({ twilio_number_e164: null }, { sharedNumberE164: null })).toBeNull();
  });
});
