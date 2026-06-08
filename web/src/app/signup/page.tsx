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
  weak_password: "Your password needs to be at least 6 characters.",
  invalid_email: "That doesn't look like a valid email address.",
  signup_failed: "We couldn't create your account. Double-check your details and try again."
};

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo: rawRedirectTo } = await searchParams;
  const redirectTo = rawRedirectTo?.startsWith("/") ? rawRedirectTo : "/owner/today";
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.signup_failed : null;
  const inviteRequired = Boolean(process.env.SIGNUP_INVITE_CODE);

  return <SignupForm errorMessage={errorMessage} redirectTo={redirectTo} inviteRequired={inviteRequired} />;
}
