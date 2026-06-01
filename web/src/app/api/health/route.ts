import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { buildDeepHealthPayload } from "@/server/health/deepHealth";
import { withRequestLogging } from "@/server/observability/requestLogging";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withRequestLogging(request, "/api/health", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const payload = await buildDeepHealthPayload();
    logger.setContext({ outcome: payload.status });

    return NextResponse.json(payload, {
      status: payload.status === "ok" ? 200 : 503
    });
  });
}
