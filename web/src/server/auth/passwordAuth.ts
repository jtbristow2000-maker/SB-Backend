import { NextRequest, NextResponse } from "next/server";

import { ensureBusinessForUser } from "@/server/business/membership";
import { getAppConfig } from "@/server/config";
import { getSupabaseServerClient } from "@/server/db/supabaseClient";
import { createSupabaseRepositories } from "@/server/db/supabaseRepositories";

import { createSupabaseRequestClient } from "./supabaseServer";

export type AuthPayload = {
  email: string;
  password: string;
  redirectTo: string | null;
  businessName: string | null;
  ownerName: string | null;
  phone: string | null;
};

function cleanRedirect(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  return value;
}

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanText(value: unknown): string {
  return cleanOptionalText(value) ?? "";
}

function readRecordText(record: Record<string, unknown>, ...names: string[]): string | null {
  for (const name of names) {
    const value = cleanOptionalText(record[name]);
    if (value) {
      return value;
    }
  }

  return null;
}

function readFormText(form: FormData, name: string): string | null {
  return cleanOptionalText(form.get(name));
}

export async function readPayload(request: NextRequest): Promise<AuthPayload | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return null;
    const record = body as Record<string, unknown>;
    return {
      email: cleanText(record.email),
      password: typeof record.password === "string" ? record.password : "",
      redirectTo: cleanRedirect(record.redirectTo),
      businessName: readRecordText(record, "business_name", "businessName"),
      ownerName: readRecordText(record, "owner_name", "ownerName"),
      phone: readRecordText(record, "phone")
    };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return null;

  return {
    email: readFormText(form, "email") ?? "",
    password: typeof form.get("password") === "string" ? String(form.get("password")) : "",
    redirectTo: cleanRedirect(form.get("redirectTo")),
    businessName: readFormText(form, "business_name"),
    ownerName: readFormText(form, "owner_name"),
    phone: readFormText(form, "phone")
  };
}

function wantsJson(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json") || accept.includes("application/json");
}

function authError(request: NextRequest, error: string, status = 400, path = "/login"): NextResponse {
  if (wantsJson(request)) {
    return NextResponse.json({ error }, { status });
  }

  const url = new URL(path, request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

function authSuccess(request: NextRequest, redirectTo: string | null): NextResponse {
  if (wantsJson(request)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL(redirectTo ?? "/owner/today", request.url), { status: 303 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function signUpErrorCode(error: unknown): string {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const text = [record.code, record.name, record.message]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  if (
    text.includes("signup_disabled") ||
    text.includes("signups disabled") ||
    text.includes("signups are disabled") ||
    text.includes("signup is disabled") ||
    text.includes("signups not allowed")
  ) {
    return "signups_disabled";
  }

  if (
    text.includes("user_already_exists") ||
    text.includes("email_exists") ||
    text.includes("email_taken") ||
    text.includes("already registered") ||
    text.includes("already been registered") ||
    text.includes("already exists")
  ) {
    return "email_taken";
  }

  if (
    text.includes("weak_password") ||
    text.includes("password should be") ||
    text.includes("password must") ||
    (text.includes("password") && text.includes("weak"))
  ) {
    return "weak_password";
  }

  if (text.includes("invalid_email") || text.includes("invalid email")) {
    return "invalid_email";
  }

  return "signup_failed";
}

type BusinessProvisionOverrides = {
  businessName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
};

async function ensureBusinessAfterAuth(
  user: { id: string; email?: string | null } | null,
  overrides: BusinessProvisionOverrides = {}
): Promise<void> {
  if (!user || getAppConfig().persistence !== "supabase") {
    return;
  }

  try {
    const repositories = createSupabaseRepositories(getSupabaseServerClient());
    await ensureBusinessForUser(
      {
        businessRepository: repositories.businessRepository,
        businessMemberRepository: repositories.businessMemberRepository
      },
      user,
      process.env,
      overrides
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "auth.business_provision_failed",
        user_id: user.id,
        error: errorMessage(error)
      })
    );
  }
}

export async function handlePasswordSignIn(request: NextRequest): Promise<NextResponse> {
  const payload = await readPayload(request);
  if (!payload?.email || !payload.password) {
    return authError(request, "email_and_password_required");
  }

  const supabase = await createSupabaseRequestClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  });

  if (error) {
    return authError(request, "invalid_login", 401);
  }

  await ensureBusinessAfterAuth(data.user);
  return authSuccess(request, payload.redirectTo);
}

export async function handlePasswordSignUp(request: NextRequest): Promise<NextResponse> {
  const payload = await readPayload(request);
  if (!payload?.email || !payload.password) {
    return authError(request, "email_and_password_required", 400, "/signup");
  }

  const supabase = await createSupabaseRequestClient();
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password
  });

  if (error) {
    return authError(request, signUpErrorCode(error), 400, "/signup");
  }

  await ensureBusinessAfterAuth(data.user, {
    businessName: payload.businessName,
    ownerName: payload.ownerName,
    phone: payload.phone
  });
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
