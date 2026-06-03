import { randomUUID } from "node:crypto";

import type { BusinessMemberRole, BusinessMemberRow, BusinessRow } from "@/server/db/schema";

import {
  type BusinessRepository,
  type BusinessSeedInput,
  getBusinessSeedFromEnv
} from "./bootstrap";

export type OwnerAuthUser = {
  id: string;
  email?: string | null;
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

function businessNameForUser(user: OwnerAuthUser, env: NodeJS.ProcessEnv): string {
  const seed = getBusinessSeedFromEnv(env);
  if (seed.name && seed.name !== "Local Service Business") {
    return seed.name;
  }

  const emailName = user.email?.split("@")[0]?.trim();
  return emailName ? `${emailName}'s Business` : "Local Service Business";
}

function businessSeedForUser(
  user: OwnerAuthUser,
  env: NodeJS.ProcessEnv
): BusinessSeedInput & { id: string } {
  const seed = getBusinessSeedFromEnv(env);
  return {
    ...seed,
    id: randomUUID(),
    name: businessNameForUser(user, env)
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
  env: NodeJS.ProcessEnv = process.env
): Promise<BusinessRow> {
  const existing = await resolveBusinessForUser(repositories, user);
  if (existing) {
    return existing;
  }

  const business = await repositories.businessRepository.create(businessSeedForUser(user, env));
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
