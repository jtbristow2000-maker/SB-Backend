import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getAppConfig } from "@/server/config";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { sendOwnerApprovedSms, validateOwnerMessagePayload } from "@/server/messages/outbound";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) {
    return authError;
  }

  const payload = await request.json().catch(() => null);
  const validation = validateOwnerMessagePayload(payload);
  if (!validation.ok) {
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
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const result = await sendOwnerApprovedSms(
    {
      customerProfileRepository: intake.customerProfileRepository,
      messageRepository: intake.messageRepository,
      auditEventRepository: intake.auditEventRepository,
      smsProvider: intake.providers.sms,
      isSmsSendingEnabled: () => getAppConfig().smsSendingEnabled
    },
    {
      business,
      payload: validation.payload
    }
  );

  if (result.status === "profile_not_found") {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  if (result.status === "profile_phone_missing") {
    return NextResponse.json({ error: "profile_phone_missing" }, { status: 400 });
  }

  return NextResponse.json({
    message: result.message,
    profile: result.profile
  });
}
