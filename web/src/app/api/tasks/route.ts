import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { buildTaskList } from "@/server/tasks/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) {
    return authError;
  }

  const intake = await getIntakeRuntime();
  const businesses = await intake.businessRepository.list();
  const business = businesses[0] ?? null;

  if (!business) {
    return NextResponse.json([]);
  }

  const status = request.nextUrl.searchParams.get("status") ?? "open";
  const tasks = await intake.taskRepository.list();

  return NextResponse.json(
    buildTaskList({
      businessId: business.id,
      tasks,
      status
    })
  );
}
