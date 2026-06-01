import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { updateTaskForOwner, validateTaskPatchPayload } from "@/server/tasks/api";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, "/api/tasks/[id]", async (logger) => {
    const authError = requireApiKey(request);
    if (authError) {
      logger.setContext({ outcome: "unauthorized" });
      return authError;
    }

    const payload = await request.json().catch(() => null);
    const validation = validateTaskPatchPayload(payload);
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
      logger.setContext({ outcome: "task_not_found" });
      return NextResponse.json({ error: "task_not_found" }, { status: 404 });
    }

    logger.setContext({ businessId: business.id });
    const result = await updateTaskForOwner(
      {
        taskRepository: intake.taskRepository,
        auditEventRepository: intake.auditEventRepository
      },
      {
        businessId: business.id,
        taskId: id,
        updates: validation.updates
      }
    );

    if (result.status === "not_found") {
      logger.setContext({ outcome: "task_not_found" });
      return NextResponse.json({ error: "task_not_found" }, { status: 404 });
    }

    logger.setContext({
      businessId: business.id,
      outcome: result.task.status
    });
    return NextResponse.json({ task: result.task });
  });
}
