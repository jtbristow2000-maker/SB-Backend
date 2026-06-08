import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRequestClient } from "@/server/auth/supabaseServer";

export const runtime = "nodejs";

// Sends a password-reset email. Always redirects to the same "sent" screen so we
// never reveal whether an account exists for the given address.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const email = typeof form?.get("email") === "string" ? String(form.get("email")).trim() : "";

  if (email) {
    try {
      const supabase = await createSupabaseRequestClient();
      const origin = new URL(request.url).origin;
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/api/auth/callback?next=/reset`
      });
    } catch {
      /* swallow — don't leak failures */
    }
  }

  return NextResponse.redirect(new URL("/forgot?sent=1", request.url), { status: 303 });
}
