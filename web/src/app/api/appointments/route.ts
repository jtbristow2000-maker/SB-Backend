import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import {
  createBusinessAppointment,
  listBusinessAppointments,
  validateAppointmentCreatePayload
} from "@/server/appointments/api";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withRequestLogging(request, "/api/appointments", async (logger) => {
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
      return NextResponse.json({ appointments: [] });
    }

    logger.setContext({ businessId: business.id, outcome: "ok" });
    const appointments = listBusinessAppointments(await intake.appointmentRepository.list(), business, {
      from: request.nextUrl.searchParams.get("from"),
      to: request.nextUrl.searchParams.get("to")
    });

    return NextResponse.json({ appointments });
  });
}

export async function POST(request: NextRequest) {
  return withRequestLogging(request, "/api/appointments", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const intake = await getIntakeRuntime();
    const businesses = await intake.businessRepository.list();
    const business = businesses[0] ?? null;
    if (!business) {
      logger.setContext({ outcome: "appointment_not_found" });
      return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
    }

    const payload = await request.json().catch(() => null);
    const validation = validateAppointmentCreatePayload(payload, business);
    if (!validation.ok) {
      logger.setContext({ businessId: business.id, outcome: validation.error });
      return NextResponse.json(
        {
          error: validation.error,
          fields: validation.fields
        },
        { status: validation.status }
      );
    }

    const result = await createBusinessAppointment(
      {
        appointmentRepository: intake.appointmentRepository,
        customerProfileRepository: intake.customerProfileRepository,
        auditEventRepository: intake.auditEventRepository
      },
      business,
      validation.value
    );
    if (!result.ok) {
      logger.setContext({ businessId: business.id, outcome: result.error });
      return NextResponse.json({ error: result.error, fields: result.fields }, { status: result.status });
    }

    logger.setContext({ businessId: business.id, outcome: "created" });
    return NextResponse.json({ appointment: result.value }, { status: 201 });
  });
}
