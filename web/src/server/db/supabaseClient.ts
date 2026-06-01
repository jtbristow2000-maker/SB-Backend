import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./schema";

type SupabaseGlobal = {
  __sbSupabaseServerClient?: SupabaseClient<Database>;
};

const globalForSupabase = globalThis as unknown as SupabaseGlobal;

export function getSupabaseServerClient(): SupabaseClient<Database> {
  if (globalForSupabase.__sbSupabaseServerClient) {
    return globalForSupabase.__sbSupabaseServerClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "PERSISTENCE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  globalForSupabase.__sbSupabaseServerClient = client;
  return client;
}
