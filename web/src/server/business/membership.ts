import { randomUUID } from "node:crypto";

import type { BusinessMemberRole, BusinessMemberRow, BusinessRow } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";

import {
  type BusinessRepository,
  type BusinessSeedInput,
  getBusinessSeedFromEnv
} from "./bootstrap";

export type OwnerAuthUser = {
  id: string;
  email?: string | null;
};

export type BusinessSeedOverrides = {
  businessName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
};

export type BusinessMemberCreateInput = {
  business_id: string;
  user_id: string;
  role?: BusinessMemberRole;
};

export interface BusinessMemberRepository {
  findByUserId(userId: string): Promise<BusinessMemberRow[]>;
  findByBusinessAndUser(businessId: string, userId: string): Promise<BusinessMemberRow | null>;
  create(input: BusinessMemberCreateInput): Promise<BusinessMemberRow>;
  list(): Promise<BusinessMemberRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanOptionalText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalOverridePhone(phone?: string | null): string | null {
  const trimmed = cleanOptionalText(phone);
  return trimmed ? normalizePhoneNumber(trimmed) : null;
}

function businessNameForUser(
  user: OwnerAuthUser,
  env: NodeJS.ProcessEnv,
  overrides: BusinessSeedOverrides = {}
): string {
  const overrideName = cleanOptionalText(overrides.businessName);
  if (overrideName) {
    return overrideName;
  }

  const seed = getBusinessSeedFromEnv(env);
  if (seed.name && seed.name !== "Local Service Business") {
    return seed.name;
  }

  const emailName = user.email?.split("@")[0]?.trim();
  return emailName ? `${emailName}'s Business` : "Local Service Business";
}

export function businessSeedForUser(
  user: OwnerAuthUser,
  env: NodeJS.ProcessEnv,
  overrides: BusinessSeedOverrides = {}
): BusinessSeedInput & { id: string } {
  const seed = getBusinessSeedFromEnv(env);
  const phoneOverride = normalizeOptionalOverridePhone(overrides.phone);

  return {
    ...seed,
    id: randomUUID(),
    name: businessNameForUser(user, env, overrides),
    ownerName: cleanOptionalText(overrides.ownerName) ?? seed.ownerName,
    ownerPhone: phoneOverride ?? seed.ownerPhone,
    businessPhone: phoneOverride ?? seed.businessPhone
  };
}

export async function resolveBusinessForUser(
  repositories: {
    businessRepository: BusinessRepository;
    businessMemberRepository: BusinessMemberRepository;
  },
  user: OwnerAuthUser
): Promise<BusinessRow | null> {
  const memberships = await repositories.businessMemberRepository.findByUserId(user.id);

  for (const membership of memberships) {
    const business = await repositories.businessRepository.findById(membership.business_id);
    if (business) {
      return business;
    }
  }

  return null;
}

export async function ensureBusinessForUser(
  repositories: {
    businessRepository: BusinessRepository;
    businessMemberRepository: BusinessMemberRepository;
  },
  user: OwnerAuthUser,
  env: NodeJS.ProcessEnv = process.env,
  overrides: BusinessSeedOverrides = {}
): Promise<BusinessRow> {
  const existing = await resolveBusinessForUser(repositories, user);
  if (existing) {
    return existing;
  }

  const business = await repositories.businessRepository.create(
    businessSeedForUser(user, env, overrides)
  );
  await repositories.businessMemberRepository.create({
    business_id: business.id,
    user_id: user.id,
    role: "owner"
  });

  return business;
}

export class InMemoryBusinessMemberRepository implements BusinessMemberRepository {
  private readonly members = new Map<string, BusinessMemberRow>();

  async findByUserId(userId: string): Promise<BusinessMemberRow[]> {
    return Array.from(this.members.values()).filter((member) => member.user_id === userId);
  }

  async findByBusinessAndUser(
    businessId: string,
    userId: string
  ): Promise<BusinessMemberRow | null> {
    return (
      Array.from(this.members.values()).find(
        (member) => member.business_id === businessId && member.user_id === userId
      ) ?? null
    );
  }

  async create(input: BusinessMemberCreateInput): Promise<BusinessMemberRow> {
    const existing = await this.findByBusinessAndUser(input.business_id, input.user_id);
    if (existing) {
      return existing;
    }

    const member: BusinessMemberRow = {
      id: randomUUID(),
      business_id: input.business_id,
      user_id: input.user_id,
      role: input.role ?? "owner",
      created_at: nowIso()
    };

    this.members.set(member.id, member);
    return member;
  }

  async list(): Promise<BusinessMemberRow[]> {
    return Array.from(this.members.values());
  }
}
