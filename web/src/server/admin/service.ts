import type { SupabaseClient, User } from "@supabase/supabase-js";

import { isAdminEmail, getAppConfig } from "@/server/config";
import type { BusinessRow, Database } from "@/server/db/schema";
import { getSupabaseServerClient } from "@/server/db/supabaseClient";
import { getIntakeRuntime, type IntakeRuntime } from "@/server/intake/runtime";
import { getCurrentUser } from "@/server/auth/session";

export type AdminBusinessSummary = Pick<
  BusinessRow,
  | "id"
  | "name"
  | "business_phone_e164"
  | "twilio_number_e164"
  | "number_status"
  | "created_at"
> & {
  lead_count: number;
  call_count: number;
  member_email: string | null;
};

type AdminUser = Pick<User, "id" | "email">;

export type AdminServiceDependencies = {
  runtime?: IntakeRuntime;
  currentUser?: AdminUser | null;
  userEmailsById?: Map<string, string | null>;
  supabaseClient?: SupabaseClient<Database>;
};

export async function requireAdminUser(
  dependencies: Pick<AdminServiceDependencies, "currentUser"> = {}
): Promise<AdminUser | null> {
  const user =
    "currentUser" in dependencies ? dependencies.currentUser : await getCurrentUser();
  return isAdminEmail(user?.email) ? user ?? null : null;
}

export async function listBusinessesForAdmin(
  dependencies: AdminServiceDependencies = {}
): Promise<AdminBusinessSummary[]> {
  const adminUser = await requireAdminUser(dependencies);
  if (!adminUser) {
    return [];
  }

  const runtime = dependencies.runtime ?? (await getIntakeRuntime());
  const [businesses, profiles, calls, memberships] = await Promise.all([
    runtime.businessRepository.listAll(),
    runtime.customerProfileRepository.list(),
    runtime.callRecordRepository.list(),
    runtime.businessMemberRepository.list()
  ]);
  const emailByUserId =
    dependencies.userEmailsById ?? (await loadSupabaseUserEmailsById(dependencies.supabaseClient));

  return businesses
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((business) => {
      const member = memberships.find((candidate) => candidate.business_id === business.id);
      return {
        id: business.id,
        name: business.name,
        business_phone_e164: business.business_phone_e164,
        twilio_number_e164: business.twilio_number_e164,
        number_status: business.number_status,
        created_at: business.created_at,
        lead_count: profiles.filter((profile) => profile.business_id === business.id).length,
        call_count: calls.filter((call) => call.business_id === business.id).length,
        member_email: member ? emailByUserId.get(member.user_id) ?? null : null
      };
    });
}

async function loadSupabaseUserEmailsById(
  supabaseClient?: SupabaseClient<Database>
): Promise<Map<string, string | null>> {
  if (getAppConfig().persistence !== "supabase") {
    return new Map();
  }

  try {
    const client = supabaseClient ?? getSupabaseServerClient();
    const { data, error } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    if (error) {
      throw error;
    }

    return new Map(data.users.map((user) => [user.id, user.email ?? null]));
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "admin.user_email_lookup_failed",
        error: error instanceof Error ? error.message : "unknown"
      })
    );
    return new Map();
  }
}
