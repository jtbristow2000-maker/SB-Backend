import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import type { TaskListItem } from "@/server/tasks/api";

import { GET as listTasks } from "../route";
import { PATCH } from "./route";

const originalEnv = {
  API_KEY: process.env.API_KEY,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureEnv(): void {
  process.env.API_KEY = "task-update-test-key";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000518";
  process.env.BUSINESS_NAME = "Task Update API Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

function patchRequest(taskId: string, body: Record<string, unknown>, apiKey?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify(body)
  });
}

function listRequest(apiKey?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/tasks?status=open", {
    headers: apiKey ? { "x-api-key": apiKey } : undefined
  });
}

function routeContext(taskId: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: taskId }) };
}

afterEach(() => {
  process.env.API_KEY = originalEnv.API_KEY;
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-17 PATCH /api/tasks/[id]", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await PATCH(
      patchRequest("task-1", { status: "done" }),
      routeContext("task-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown task id", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await PATCH(
      patchRequest("missing-task", { status: "done" }, "task-update-test-key"),
      routeContext("missing-task")
    );

    expect(response.status).toBe(404);
  });

  it("rejects unknown fields and invalid values", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const task = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: "profile-reject",
      task_type: "callback",
      title: "Call back",
      status: "open"
    });

    const unknownField = await PATCH(
      patchRequest(
        task.id,
        { status: "done", customer_profile_id: "nope" },
        "task-update-test-key"
      ),
      routeContext(task.id)
    );
    const invalidStatus = await PATCH(
      patchRequest(task.id, { status: "completed" }, "task-update-test-key"),
      routeContext(task.id)
    );

    expect(unknownField.status).toBe(400);
    expect(await unknownField.json()).toMatchObject({
      error: "unknown_task_update_fields",
      fields: ["customer_profile_id"]
    });
    expect(invalidStatus.status).toBe(400);
    expect(await invalidStatus.json()).toMatchObject({
      error: "invalid_task_update_field_values",
      fields: ["status"]
    });
    expect(await runtime.auditEventRepository.list()).toHaveLength(0);
  });

  it("completes a callback task, removes it from the open list, and audits the change", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550100",
        displayName: "Task Customer",
        source: "incoming_call"
      })
    ).profile;
    const task = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      task_type: "callback",
      title: "Call back missed caller",
      notes: "Voicemail needs follow-up.",
      due_at: "2026-06-01T16:00:00.000Z",
      status: "open"
    });

    const response = await PATCH(
      patchRequest(task.id, { status: "done" }, "task-update-test-key"),
      routeContext(task.id)
    );
    const body = await response.json();
    const openResponse = await listTasks(listRequest("task-update-test-key"));
    const openTasks = (await openResponse.json()) as TaskListItem[];
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(body.task).toMatchObject({
      id: task.id,
      status: "done",
      customer_profile_id: profile.id
    });
    expect(openResponse.status).toBe(200);
    expect(openTasks.some((item) => item.id === task.id)).toBe(false);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "task.update",
      business_id: business.id,
      customer_profile_id: profile.id
    });
    expect(auditEvents[0].event_json).toMatchObject({
      taskId: task.id,
      changes: {
        status: { from: "open", to: "done" }
      }
    });
  });
});
