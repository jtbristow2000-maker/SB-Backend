import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import {
  deleteBusinessAppointment,
  updateBusinessAppointment,
  validateAppointmentUpdatePayload
} from "@/server/appointments/api";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, "/api/appointments/[id]", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const payload = await request.json().catch(() => null);
    const validation = validateAppointmentUpdatePayload(payload);
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
    const business = (await intake.businessRepository.list())[0] ?? null;
    if (!business) {
      logger.setContext({ outcome: "appointment_not_found" });
      return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
    }

    const result = await updateBusinessAppointment(
      {
        appointmentRepository: intake.appointmentRepository,
        customerProfileRepository: intake.customerProfileRepository,
        auditEventRepository: intake.auditEventRepository
      },
      business,
      id,
      validation.value
    );
    if (!result.ok) {
      logger.setContext({ businessId: business.id, outcome: result.error });
      return NextResponse.json({ error: result.error, fields: result.fields }, { status: result.status });
    }

    logger.setContext({ businessId: business.id, outcome: "updated" });
    return NextResponse.json({ appointment: result.value });
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, "/api/appointments/[id]", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const { id } = await context.params;
    const intake = await getIntakeRuntime();
    const business = (await intake.businessRepository.list())[0] ?? null;
    if (!business) {
      logger.setContext({ outcome: "appointment_not_found" });
      return NextResponse.json({ error: "appointment_not_found" }, { status: 404 });
    }

    const result = await deleteBusinessAppointment(
      {
        appointmentRepository: intake.appointmentRepository,
        customerProfileRepository: intake.customerProfileRepository,
        auditEventRepository: intake.auditEventRepository
      },
      business,
      id
    );
    if (!result.ok) {
      logger.setContext({ businessId: business.id, outcome: result.error });
      return NextResponse.json({ error: result.error, fields: result.fields }, { status: result.status });
    }

    logger.setContext({ businessId: business.id, outcome: "deleted" });
    return NextResponse.json({ deleted: true, id: result.value.id });
  });
}
