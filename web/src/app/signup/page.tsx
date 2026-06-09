import Link from "next/link";

import { authCard } from "@/app/auth-card";

import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

// Dedicated owner sign-up screen. Server component reads the error/redirect
// query params (set by /api/auth/sign-up on failure) and maps known error codes
// to specific, friendly messages; the client SignupForm handles inline checks.

const ERROR_MESSAGES: Record<string, string> = {
  email_and_password_required: "Please fill in your email and a password.",
  signups_disabled: "New sign-ups are turned off right now.",
  invalid_invite: "That invite code isn't valid — check it and try again.",
  email_taken: "An account with that email already exists — try signing in instead.",
  weak_password: "Your password needs at least 8 characters, one uppercase letter, and one number.",
  invalid_email: "That doesn't look like a valid email address.",
  signup_failed: "We couldn't create your account. Double-check your details and try again."
};

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string; check_email?: string }>;
}) {
  const { error, redirectTo: rawRedirectTo, check_email: checkEmail } = await searchParams;
  const redirectTo = rawRedirectTo?.startsWith("/") ? rawRedirectTo : "/owner/today";
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.signup_failed : null;
  const inviteRequired = Boolean(process.env.SIGNUP_INVITE_CODE);

  if (checkEmail) {
    return (
      <main style={authCard.shell}>
        <section style={authCard.card}>
          <div style={authCard.eyebrow}>Almost there</div>
          <h1 style={authCard.h1}>Check your email</h1>
          <div style={authCard.ok}>
            We sent a confirmation link to your email. Click it to verify your account, then sign in.
          </div>
          <Link href="/login" style={authCard.secondary}>Back to sign in</Link>
        </section>
      </main>
    );
  }

  return <SignupForm errorMessage={errorMessage} redirectTo={redirectTo} inviteRequired={inviteRequired} />;
}
