import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { buildTaskList } from "@/server/tasks/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withRequestLogging(request, "/api/tasks", async (logger) => {
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
    const status = request.nextUrl.searchParams.get("status") ?? "open";
    const tasks = await intake.taskRepository.list();

    return NextResponse.json(
      buildTaskList({
        businessId: business.id,
        tasks,
        status
      })
    );
  });
}
