import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRequestClient } from "./supabaseServer";

type AuthPayload = {
  email: string;
  password: string;
  redirectTo: string | null;
};

function cleanRedirect(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  return value;
}

async function readPayload(request: NextRequest): Promise<AuthPayload | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    return {
      email: typeof record.email === "string" ? record.email.trim() : "",
      password: typeof record.password === "string" ? record.password : "",
      redirectTo: cleanRedirect(record.redirectTo)
    };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return null;

  return {
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    redirectTo: cleanRedirect(form.get("redirectTo"))
  };
}

function wantsJson(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json") || accept.includes("application/json");
}

function authError(request: NextRequest, error: string, status = 400): NextResponse {
  if (wantsJson(request)) {
    return NextResponse.json({ error }, { status });
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

function authSuccess(request: NextRequest, redirectTo: string | null): NextResponse {
  if (wantsJson(request)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL(redirectTo ?? "/owner/today", request.url), { status: 303 });
}

export async function handlePasswordSignIn(request: NextRequest): Promise<NextResponse> {
  const payload = await readPayload(request);
  if (!payload?.email || !payload.password) {
    return authError(request, "email_and_password_required");
  }

  const supabase = await createSupabaseRequestClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  });

  if (error) {
    return authError(request, "invalid_login", 401);
  }

  return authSuccess(request, payload.redirectTo);
}

export async function handlePasswordSignUp(request: NextRequest): Promise<NextResponse> {
  const payload = await readPayload(request);
  if (!payload?.email || !payload.password) {
    return authError(request, "email_and_password_required");
  }

  const supabase = await createSupabaseRequestClient();
  const { error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password
  });

  if (error) {
    return authError(request, "signup_failed", 400);
  }

  return authSuccess(request, payload.redirectTo);
}

export async function handleSignOut(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseRequestClient();
  await supabase.auth.signOut();

  if (wantsJson(request)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
