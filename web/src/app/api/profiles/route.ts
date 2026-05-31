import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { buildCallbackProfileList } from "@/server/profiles/callbacks";

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
}
