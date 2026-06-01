import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { buildCallbackProfileList } from "@/server/profiles/callbacks";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withRequestLogging(request, "/api/profiles", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const intake = await getIntakeRuntime();
    const businesses = await intake.businessRepository.list();
    const business = businesses[0] ?? null;

    if (!business) {
      logger.setContext({ outcome: "no_business" });
      return NextResponse.json([]);
    }

    logger.setContext({ businessId: business.id });
    const [profiles, calls, messages, tasks] = await Promise.all([
      intake.customerProfileRepository.list(),
      intake.callRecordRepository.list(),
      intake.messageRepository.list(),
      intake.taskRepository.list()
    ]);

    return NextResponse.json(
      buildCallbackProfileList({
        businessId: business.id,
        profiles,
        calls,
        messages,
        tasks
      })
    );
  });
}
