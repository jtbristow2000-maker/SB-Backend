import { describe, expect, it } from "vitest";

import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { InMemoryAuditEventRepository } from "@/server/intake/auditEvents";
import { updateProfileForOwner } from "@/server/profiles/update";

import { InMemoryBusinessRepository } from "./bootstrap";
import {
  businessSeedForUser,
  ensureBusinessForUser,
  InMemoryBusinessMemberRepository,
  resolveBusinessForUser
} from "./membership";

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}

describe("owner business membership", () => {
  it("creates exactly one business and owner membership for a new user", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    const businessMemberRepository = new InMemoryBusinessMemberRepository();
    const user = { id: "user-one", email: "owner@example.com" };

    const first = await ensureBusinessForUser(
      { businessRepository, businessMemberRepository },
      user,
      env({
        BUSINESS_NAME: "Owner Detail Co",
        OWNER_PHONE: "+12133734253",
        BUSINESS_PHONE: "+13105550199",
        TIMEZONE: "America/New_York"
      })
    );
    const second = await ensureBusinessForUser(
      { businessRepository, businessMemberRepository },
      user
    );

    expect(second.id).toBe(first.id);
    expect(await businessRepository.list()).toHaveLength(1);
    expect(await businessMemberRepository.list()).toMatchObject([
      {
        business_id: first.id,
        user_id: user.id,
        role: "owner"
      }
    ]);
    expect(first.name).toBe("Owner Detail Co");
    expect(first.business_phone_e164).toBe("+13105550199");
  });

  it("uses sign-up overrides for a newly provisioned business", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    const businessMemberRepository = new InMemoryBusinessMemberRepository();

    const business = await ensureBusinessForUser(
      { businessRepository, businessMemberRepository },
      { id: "user-overrides", email: "fallback@example.com" },
      env({
        BUSINESS_NAME: "Env Detail Co",
        OWNER_NAME: "Env Owner",
        OWNER_PHONE: "+13105550199",
        BUSINESS_PHONE: "+13105550200",
        TIMEZONE: "America/Chicago"
      }),
      {
        businessName: "  Shaw Mobile Detail  ",
        ownerName: " Shaw ",
        phone: " (213) 373-4253 "
      }
    );

    expect(business).toMatchObject({
      name: "Shaw Mobile Detail",
      owner_name: "Shaw",
      owner_phone_e164: "+12133734253",
      business_phone_e164: "+12133734253",
      timezone: "America/Chicago"
    });
  });

  it("keeps the existing fallback business name when sign-up overrides are blank", () => {
    const seed = businessSeedForUser(
      { id: "user-blank-overrides", email: "fresh.owner@example.com" },
      env({}),
      { businessName: " ", ownerName: " ", phone: " " }
    );

    expect(seed).toMatchObject({
      name: "fresh.owner's Business",
      ownerName: null,
      ownerPhone: null,
      businessPhone: null
    });
  });

  it("resolves each signed-in user to their own business membership", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    const businessMemberRepository = new InMemoryBusinessMemberRepository();

    const first = await ensureBusinessForUser(
      { businessRepository, businessMemberRepository },
      { id: "user-a", email: "a@example.com" },
      env({ BUSINESS_NAME: "A Detail Co" })
    );
    const second = await ensureBusinessForUser(
      { businessRepository, businessMemberRepository },
      { id: "user-b", email: "b@example.com" },
      env({ BUSINESS_NAME: "B Detail Co" })
    );

    await businessRepository.updateSettings(first.id, { brand_color: "#123abc" });

    expect(
      await resolveBusinessForUser(
        { businessRepository, businessMemberRepository },
        { id: "user-a" }
      )
    ).toMatchObject({ id: first.id, name: "A Detail Co" });
    expect(
      await resolveBusinessForUser(
        { businessRepository, businessMemberRepository },
        { id: "user-b" }
      )
    ).toMatchObject({ id: second.id, name: "B Detail Co" });
  });

  it("does not let an owner mutation touch another business's profile", async () => {
    const businessRepository = new InMemoryBusinessRepository();
    const businessMemberRepository = new InMemoryBusinessMemberRepository();
    const customerProfileRepository = new InMemoryCustomerProfileRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();

    const userBusiness = await ensureBusinessForUser(
      { businessRepository, businessMemberRepository },
      { id: "user-a", email: "a@example.com" },
      env({ BUSINESS_NAME: "A Detail Co" })
    );
    const otherBusiness = await ensureBusinessForUser(
      { businessRepository, businessMemberRepository },
      { id: "user-b", email: "b@example.com" },
      env({ BUSINESS_NAME: "B Detail Co" })
    );
    const otherProfile = await customerProfileRepository.create({
      business_id: otherBusiness.id,
      display_name: "Other Customer",
      phone_e164: "+14155550100",
      email: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      source: "manual",
      status: "new",
      summary: null,
      notes: null,
      last_contact_at: null
    });

    const result = await updateProfileForOwner(
      { customerProfileRepository, auditEventRepository },
      {
        businessId: userBusiness.id,
        profileId: otherProfile.id,
        updates: { status: "booked" }
      }
    );

    expect(result).toEqual({ status: "not_found" });
    expect((await customerProfileRepository.list())[0]).toMatchObject({
      id: otherProfile.id,
      status: "new"
    });
    expect(await auditEventRepository.list()).toHaveLength(0);
  });
});
