import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRequestClient } from "@/server/auth/supabaseServer";
import { meetsPasswordPolicy } from "@/server/auth/passwordPolicy";

export const runtime = "nodejs";

// Sets a new password for the recovery session established by the reset link
// (via /api/auth/callback). Signs out afterward so they re-login with the new one.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const password = typeof form?.get("password") === "string" ? String(form.get("password")) : "";

  if (!meetsPasswordPolicy(password)) {
    return NextResponse.redirect(new URL("/reset?error=weak", request.url), { status: 303 });
  }

  const supabase = await createSupabaseRequestClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.redirect(new URL("/reset?error=failed", request.url), { status: 303 });
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?reset=1", request.url), { status: 303 });
}
