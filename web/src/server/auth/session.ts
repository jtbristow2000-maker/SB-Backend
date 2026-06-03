import type { Session, User } from "@supabase/supabase-js";

import { createSupabaseRequestClient } from "./supabaseServer";

export async function getServerSession(): Promise<Session | null> {
  const supabase = await createSupabaseRequestClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseRequestClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}
