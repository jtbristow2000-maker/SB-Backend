import Link from "next/link";

import { getCurrentUser } from "@/server/auth/session";
import { authCard as S } from "@/app/auth-card";
import { ResetPasswordForm } from "@/app/ResetPasswordForm";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  weak: "Your new password needs at least 8 characters, one uppercase letter, and one number.",
  failed: "We couldn't update your password — request a fresh reset link and try again."
};

export default async function ResetPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // The reset link runs through /api/auth/callback, which establishes a recovery
  // session — so a valid link means there's a current user here.
  const user = await getCurrentUser();

  return (
    <main style={S.shell}>
      <section style={S.card}>
        <div style={S.eyebrow}>Reset password</div>
        <h1 style={S.h1}>Set a new password</h1>
        {error && <div style={S.error}>{ERRORS[error] ?? "Something went wrong — try again."}</div>}

        {user ? (
          <ResetPasswordForm />
        ) : (
          <>
            <div style={S.sub}>This reset link is invalid or has expired. Request a new one.</div>
            <Link href="/forgot" style={S.secondary}>Get a new link</Link>
          </>
        )}
      </section>
    </main>
  );
}
