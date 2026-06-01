import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getAppConfig } from "@/server/config";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { sendOwnerApprovedSms, validateOwnerMessagePayload } from "@/server/messages/outbound";
import { withRequestLogging } from "@/server/observability/requestLogging";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, "/api/messages", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const payload = await request.json().catch(() => null);
    const validation = validateOwnerMessagePayload(payload);
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

    const intake = await getIntakeRuntime();
    const businesses = await intake.businessRepository.list();
    const business = businesses[0] ?? null;

    if (!business) {
      logger.setContext({ outcome: "profile_not_found" });
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    logger.setContext({ businessId: business.id });
    const result = await sendOwnerApprovedSms(
      {
        customerProfileRepository: intake.customerProfileRepository,
        messageRepository: intake.messageRepository,
        auditEventRepository: intake.auditEventRepository,
        smsProvider: intake.smsProvider,
        isSmsSendingEnabled: () => getAppConfig().smsSendingEnabled
      },
      {
        business,
        payload: validation.payload
      }
    );

    if (result.status === "profile_not_found") {
      logger.setContext({ outcome: "profile_not_found" });
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    if (result.status === "profile_phone_missing") {
      logger.setContext({ outcome: "profile_phone_missing" });
      return NextResponse.json({ error: "profile_phone_missing" }, { status: 400 });
    }

    logger.setContext({ businessId: business.id, outcome: result.message.status });
    return NextResponse.json({
      message: result.message,
      profile: result.profile
    });
  });
}
