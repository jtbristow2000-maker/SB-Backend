import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createSupabaseRequestClient } from "@/server/auth/supabaseServer";

export const runtime = "nodejs";

// Shared callback for Supabase email links (password reset + email confirmation).
// Handles both link styles: PKCE `?code=` (exchangeCodeForSession) and the
// `?token_hash=&type=` OTP form (verifyOtp — robust across devices). On success we
// have a session cookie, then forward to `next` (the reset form, or the dashboard).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/owner/today";

  const expired = () =>
    NextResponse.redirect(new URL("/login?error=link_expired", request.url), { status: 303 });

  try {
    const supabase = await createSupabaseRequestClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return expired();
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
      if (error) return expired();
    }
  } catch {
    return expired();
  }

  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
