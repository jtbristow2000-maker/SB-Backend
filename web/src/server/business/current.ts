import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getAppConfig, isAdminEmail } from "@/server/config";
import { createSupabaseRepositories } from "@/server/db/supabaseRepositories";
import { getSupabaseServerClient } from "@/server/db/supabaseClient";
import { buildIntakeRuntime, getIntakeRuntime, type IntakeRuntime } from "@/server/intake/runtime";
import { getCurrentUser } from "@/server/auth/session";
import { createSupabaseRequestClient } from "@/server/auth/supabaseServer";
import type { BusinessRow } from "@/server/db/schema";

import { ensureBusinessForUser } from "./membership";

export const ADMIN_IMPERSONATION_COOKIE = "snagly_admin_business";

export type OwnerBusinessContext = {
  rt: IntakeRuntime;
  business: BusinessRow;
  user: User | null;
  impersonating: { businessId: string; businessName: string } | null;
};

async function getMemoryBusinessContext(): Promise<OwnerBusinessContext | null> {
  const rt = await getIntakeRuntime();
  const business = (await rt.businessRepository.list())[0] ?? null;

  return business ? { rt, business, user: null, impersonating: null } : null;
}

async function getSupabaseBusinessContext(): Promise<OwnerBusinessContext | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const serviceRepositories = createSupabaseRepositories(getSupabaseServerClient());
  const serviceRuntime = buildIntakeRuntime(serviceRepositories);
  const impersonatedContext = await resolveAdminImpersonatedContext({
    user,
    businessId: await readAdminImpersonationCookie(),
    serviceRuntime
  });
  if (impersonatedContext) {
    return impersonatedContext;
  }

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
    user,
    impersonating: null
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

export async function resolveAdminImpersonatedContext(input: {
  user: Pick<User, "email">;
  businessId: string | null | undefined;
  serviceRuntime: IntakeRuntime;
}): Promise<OwnerBusinessContext | null> {
  if (!isAdminEmail(input.user.email) || !input.businessId?.trim()) {
    return null;
  }

  const business = await input.serviceRuntime.businessRepository.findById(input.businessId.trim());
  if (!business) {
    return null;
  }

  await input.serviceRuntime.auditEventRepository.create({
    business_id: business.id,
    actor: "system",
    event_type: "admin.impersonation_used",
    event_json: {
      adminEmail: input.user.email?.trim().toLowerCase() ?? null,
      businessId: business.id,
      businessName: business.name
    }
  });

  return {
    rt: input.serviceRuntime,
    business,
    user: input.user as User,
    impersonating: {
      businessId: business.id,
      businessName: business.name
    }
  };
}

async function readAdminImpersonationCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ADMIN_IMPERSONATION_COOKIE)?.value?.trim() || null;
  } catch {
    return null;
  }
}
