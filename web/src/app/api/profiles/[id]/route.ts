import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { buildProfileDetail } from "@/server/profiles/detail";
import { updateProfileForOwner, validateProfileUpdatePayload } from "@/server/profiles/update";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, "/api/profiles/[id]", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const { id } = await context.params;
    const intake = await getIntakeRuntime();
    const businesses = await intake.businessRepository.list();
    const business = businesses[0] ?? null;

    if (!business) {
      logger.setContext({ outcome: "profile_not_found" });
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    logger.setContext({ businessId: business.id });
    const [profiles, calls, messages, tasks, appointments, quoteDrafts] = await Promise.all([
      intake.customerProfileRepository.list(),
      intake.callRecordRepository.list(),
      intake.messageRepository.list(),
      intake.taskRepository.list(),
      intake.appointmentRepository.list(),
      intake.quoteDraftRepository.list()
    ]);
    const detail = buildProfileDetail({
      businessId: business.id,
      profileId: id,
      profiles,
      calls,
      messages,
      tasks,
      appointments,
      quoteDrafts
    });

    if (!detail) {
      logger.setContext({ outcome: "profile_not_found" });
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, "/api/profiles/[id]", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const payload = await request.json().catch(() => null);
    const validation = validateProfileUpdatePayload(payload);
    if (!validation.ok) {
      logger.setContext({ outcome: validation.error });
      return NextResponse.json(
        {
          error: validation.error,
          fields: validation.fields
        },
        { status: validation.status }
      );
    }

    const { id } = await context.params;
    const intake = await getIntakeRuntime();
    const businesses = await intake.businessRepository.list();
    const business = businesses[0] ?? null;

    if (!business) {
      logger.setContext({ outcome: "profile_not_found" });
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    logger.setContext({ businessId: business.id });
    const result = await updateProfileForOwner(
      {
        customerProfileRepository: intake.customerProfileRepository,
        auditEventRepository: intake.auditEventRepository
      },
      {
        businessId: business.id,
        profileId: id,
        updates: validation.updates
      }
    );

    if (result.status === "not_found") {
      logger.setContext({ outcome: "profile_not_found" });
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    logger.setContext({ outcome: "updated" });
    return NextResponse.json({ profile: result.profile });
  });
}
