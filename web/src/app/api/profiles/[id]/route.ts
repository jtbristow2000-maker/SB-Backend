import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { buildProfileDetail } from "@/server/profiles/detail";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = requireApiKey(request);
  if (authError) {
    return authError;
  }

  const { id } = await context.params;
  const intake = await getIntakeRuntime();
  const businesses = await intake.businessRepository.list();
  const business = businesses[0] ?? null;

  if (!business) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const [profiles, calls, messages, tasks] = await Promise.all([
    intake.customerProfileRepository.list(),
    intake.callRecordRepository.list(),
    intake.messageRepository.list(),
    intake.taskRepository.list()
  ]);
  const detail = buildProfileDetail({
    businessId: business.id,
    profileId: id,
    profiles,
    calls,
    messages,
    tasks
  });

  if (!detail) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
