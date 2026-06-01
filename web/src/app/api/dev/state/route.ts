import { NextRequest, NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";

export const runtime = "nodejs";

// Dev/sandbox-only read surface that powers the clickable Sandbox Console (the home page).
// It returns the current in-memory intake state. This is NOT the production read API
// (that is BACKEND-14/15) - it exists so the missed-call pipeline is visible while testing.
export async function GET(request: NextRequest) {
  return withRequestLogging(request, "/api/dev/state", async (logger) => {
    if (!getAppConfig().sandboxMode) {
      logger.setContext({ outcome: "sandbox_disabled" });
      return NextResponse.json({ error: "dev console disabled outside sandbox" }, { status: 404 });
    }

    try {
      const intake = await getIntakeRuntime();

      // Convenience: in sandbox the seeded business often has no phone (env not set).
      // Give it sandbox defaults so the console can drive the voice/SMS webhooks zero-config.
      // NOTE: these MUST be valid NANP numbers - phone normalization rejects 555 numbers.
      const businesses = await intake.businessRepository.list();
      let business = businesses[0] ?? null;
      if (business && (!business.business_phone_e164 || !business.owner_phone_e164)) {
        try {
          business = await intake.businessRepository.update(business.id, {
            name: business.name,
            ownerName: business.owner_name,
            ownerPhone: business.owner_phone_e164 ?? "+13104567890",
            businessPhone: business.business_phone_e164 ?? "+14157654321",
            timezone: business.timezone
          });
        } catch {
          // If a default fails normalization for any reason, keep the business as-is.
        }
      }

      const [profiles, calls, messages, tasks] = await Promise.all([
        intake.customerProfileRepository.list(),
        intake.callRecordRepository.list(),
        intake.messageRepository.list(),
        intake.taskRepository.list()
      ]);

      logger.setContext({
        businessId: business?.id ?? null,
        outcome: "ok"
      });
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
    } catch (e) {
      logger.setContext({ outcome: "error" });
      // Surface the real reason so the console can show it instead of a blank 500.
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "dev state failed" },
        { status: 500 }
      );
    }
  });
}
