import Link from "next/link";

import { getCurrentUser } from "@/server/auth/session";
import { authCard as S } from "@/app/auth-card";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  weak: "Your new password needs to be at least 6 characters.",
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
          <form action="/api/auth/update-password" method="post" style={S.form}>
            <label style={S.label}>
              New password
              <input name="password" type="password" required minLength={6} autoComplete="new-password" style={S.input} />
              <span style={S.hint}>At least 6 characters.</span>
            </label>
            <button type="submit" style={S.primary}>Update password</button>
          </form>
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
