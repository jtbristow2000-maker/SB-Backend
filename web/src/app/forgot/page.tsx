import Link from "next/link";

import { authCard as S } from "@/app/auth-card";

export const dynamic = "force-dynamic";

export default async function ForgotPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main style={S.shell}>
      <section style={S.card}>
        <div style={S.eyebrow}>Reset password</div>
        <h1 style={S.h1}>Forgot your password?</h1>

        {sent ? (
          <>
            <div style={S.ok}>
              If an account exists for that email, we just sent a reset link. Check your inbox (and spam folder).
            </div>
            <Link href="/login" style={S.secondary}>Back to sign in</Link>
          </>
        ) : (
          <form action="/api/auth/forgot" method="post" style={S.form}>
            <div style={S.sub}>Enter your email and we&apos;ll send a link to set a new password.</div>
            <label style={S.label}>
              Email
              <input name="email" type="email" required autoComplete="email" style={S.input} />
            </label>
            <button type="submit" style={S.primary}>Send reset link</button>
            <Link href="/login" style={S.linkBack}>Back to sign in</Link>
          </form>
        )}
      </section>
    </main>
  );
}
