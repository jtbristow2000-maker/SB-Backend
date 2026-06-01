import { NextRequest, NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";
import { resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";

export const runtime = "nodejs";

// Dev/sandbox-only: clears the in-memory intake state so the console can start fresh.
export async function POST(request: NextRequest) {
  return withRequestLogging(request, "/api/dev/reset", async (logger) => {
    if (!getAppConfig().sandboxMode) {
      logger.setContext({ outcome: "sandbox_disabled" });
      return NextResponse.json({ error: "dev console disabled outside sandbox" }, { status: 404 });
    }

    resetIntakeRuntimeForTests();
    logger.setContext({ outcome: "ok" });
    return NextResponse.json({ ok: true });
  });
}
