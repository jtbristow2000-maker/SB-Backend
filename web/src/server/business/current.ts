import type { User } from "@supabase/supabase-js";

import { getAppConfig } from "@/server/config";
import { createSupabaseRepositories } from "@/server/db/supabaseRepositories";
import { getSupabaseServerClient } from "@/server/db/supabaseClient";
import { buildIntakeRuntime, getIntakeRuntime, type IntakeRuntime } from "@/server/intake/runtime";
import { getCurrentUser } from "@/server/auth/session";
import { createSupabaseRequestClient } from "@/server/auth/supabaseServer";
import type { BusinessRow } from "@/server/db/schema";

import { ensureBusinessForUser } from "./membership";

export type OwnerBusinessContext = {
  rt: IntakeRuntime;
  business: BusinessRow;
  user: User | null;
};

async function getMemoryBusinessContext(): Promise<OwnerBusinessContext | null> {
  const rt = await getIntakeRuntime();
  const business = (await rt.businessRepository.list())[0] ?? null;

  return business ? { rt, business, user: null } : null;
}

async function getSupabaseBusinessContext(): Promise<OwnerBusinessContext | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const serviceRepositories = createSupabaseRepositories(getSupabaseServerClient());
  const ensuredBusiness = await ensureBusinessForUser(
    {
      businessRepository: serviceRepositories.businessRepository,
      businessMemberRepository: serviceRepositories.businessMemberRepository
    },
    user
  );

  const requestClient = await createSupabaseRequestClient();
  const userRepositories = createSupabaseRepositories(requestClient);
  const business = await userRepositories.businessRepository.findById(ensuredBusiness.id);
  if (!business) {
    return null;
  }

  return {
    rt: buildIntakeRuntime(userRepositories),
    business,
    user
  };
}

export async function getOwnerBusinessContext(): Promise<OwnerBusinessContext | null> {
  return getAppConfig().persistence === "supabase"
    ? getSupabaseBusinessContext()
    : getMemoryBusinessContext();
}

export async function getCurrentBusiness(): Promise<BusinessRow | null> {
  return (await getOwnerBusinessContext())?.business ?? null;
}
