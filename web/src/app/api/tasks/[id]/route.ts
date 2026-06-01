import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { updateTaskForOwner, validateTaskPatchPayload } from "@/server/tasks/api";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = requireApiKey(request);
  if (authError) {
    return authError;
  }

  const payload = await request.json().catch(() => null);
  const validation = validateTaskPatchPayload(payload);
  if (!validation.ok) {
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
    return NextResponse.json({ error: "task_not_found" }, { status: 404 });
  }

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
    return NextResponse.json({ error: "task_not_found" }, { status: 404 });
  }

  return NextResponse.json({ task: result.task });
}
