import { NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";
import { getIntakeRuntime } from "@/server/intake/runtime";

export const runtime = "nodejs";

// Dev/sandbox-only read surface that powers the clickable Sandbox Console (the home page).
// It returns the current in-memory intake state. This is NOT the production read API
// (that is BACKEND-14/15) — it exists so the missed-call pipeline is visible while testing.
export async function GET() {
  if (!getAppConfig().sandboxMode) {
    return NextResponse.json({ error: "dev console disabled outside sandbox" }, { status: 404 });
  }

  const intake = await getIntakeRuntime();

  // Convenience: in sandbox the seeded business often has no phone (env not set).
  // Give it sandbox defaults so the console can drive the voice/SMS webhooks zero-config.
  const businesses = await intake.businessRepository.list();
  let business = businesses[0] ?? null;
  if (business && (!business.business_phone_e164 || !business.owner_phone_e164)) {
    business = await intake.businessRepository.update(business.id, {
      name: business.name,
      ownerName: business.owner_name,
      ownerPhone: business.owner_phone_e164 ?? "+15559990000",
      businessPhone: business.business_phone_e164 ?? "+15557654321",
      timezone: business.timezone
    });
  }

  const [profiles, calls, messages, tasks] = await Promise.all([
    intake.customerProfileRepository.list(),
    intake.callRecordRepository.list(),
    intake.messageRepository.list(),
    intake.taskRepository.list()
  ]);

  return NextResponse.json({
    business: business
      ? {
          id: business.id,
          name: business.name,
          businessPhone: business.business_phone_e164,
          ownerPhone: business.owner_phone_e164
        }
      : null,
    smsSendingEnabled: getAppConfig().smsSendingEnabled,
    profiles,
    calls,
    messages,
    tasks
  });
}
