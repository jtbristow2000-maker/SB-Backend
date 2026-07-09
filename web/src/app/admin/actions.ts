"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/server/admin/service";
import { ADMIN_IMPERSONATION_COOKIE } from "@/server/business/current";

// Admin-only: step into a customer's account (the owner UI then runs against
// their business — see getOwnerBusinessContext) and back out again. The cookie
// alone grants nothing; the context re-checks the admin email on every request.

export async function openBusinessAsAdmin(formData: FormData): Promise<void> {
  const admin = await requireAdminUser();
  if (!admin) return;
  const businessId = String(formData.get("businessId") ?? "").trim();
  if (!businessId) return;

  const store = await cookies();
  store.set(ADMIN_IMPERSONATION_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  redirect("/owner/today");
}

export async function exitAdminImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_IMPERSONATION_COOKIE);
  redirect("/admin");
}
