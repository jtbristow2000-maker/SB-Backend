import { NextRequest, NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";
import { createSupabaseRequestClient } from "@/server/auth/supabaseServer";

export const runtime = "nodejs";

// Sends a password-reset email. Always redirects to the same "sent" screen so we
// never reveal whether an account exists for the given address. The reset link
// returns to our callback — using the configured public base URL (reliable on
// Vercel) rather than request.url, which otherwise makes Supabase fall back to the
// bare Site URL root and skip the callback.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const email = typeof form?.get("email") === "string" ? String(form.get("email")).trim() : "";

  if (email) {
    try {
      const supabase = await createSupabaseRequestClient();
      const base = getAppConfig().publicBaseUrl ?? new URL(request.url).origin;
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${base}/api/auth/callback?next=/reset`
      });
    } catch {
      /* swallow — don't leak failures */
    }
  }

  return NextResponse.redirect(new URL("/forgot?sent=1", request.url), { status: 303 });
}
