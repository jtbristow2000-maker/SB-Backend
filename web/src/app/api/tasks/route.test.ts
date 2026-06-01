import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import type { TaskListItem } from "@/server/tasks/api";

import { GET } from "./route";

const originalEnv = {
  API_KEY: process.env.API_KEY,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureEnv(): void {
  process.env.API_KEY = "tasks-test-key";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000517";
  process.env.BUSINESS_NAME = "Task API Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

function tasksRequest(apiKey?: string, status?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/tasks");
  if (status) {
    url.searchParams.set("status", status);
  }

  return new NextRequest(url, {
    headers: apiKey ? { "x-api-key": apiKey } : undefined
  });
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

describe("BACKEND-17 GET /api/tasks", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await GET(tasksRequest());

    expect(response.status).toBe(401);
  });

  it("returns only open tasks by default sorted by due_at then created_at", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];

    const later = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: "profile-later",
      task_type: "callback",
      title: "Later callback",
      notes: "Second due task",
      due_at: "2026-06-02T14:00:00.000Z",
      status: "open"
    });
    const earliest = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: "profile-earliest",
      task_type: "callback",
      title: "Earliest callback",
      due_at: "2026-06-01T14:00:00.000Z",
      status: "open"
    });
    const unscheduled = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: "profile-unscheduled",
      task_type: "follow_up",
      title: "No due date",
      status: "open"
    });
    await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: "profile-dismissed",
      task_type: "callback",
      title: "Dismissed callback",
      due_at: "2026-06-01T13:00:00.000Z",
      status: "dismissed"
    });
    await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: "profile-done",
      task_type: "callback",
      title: "Done callback",
      due_at: "2026-06-01T12:00:00.000Z",
      status: "done"
    });

    const response = await GET(tasksRequest("tasks-test-key"));
    const body = (await response.json()) as TaskListItem[];

    expect(response.status).toBe(200);
    expect(body.map((task) => task.id)).toEqual([earliest.id, later.id, unscheduled.id]);
    expect(body[0]).toEqual({
      id: earliest.id,
      customer_profile_id: "profile-earliest",
      task_type: "callback",
      title: "Earliest callback",
      notes: null,
      due_at: "2026-06-01T14:00:00.000Z",
      status: "open",
      created_at: earliest.created_at
    });
    expect(body[1]).toMatchObject({
      id: later.id,
      notes: "Second due task"
    });
    expect(body[2]).toMatchObject({
      id: unscheduled.id,
      due_at: null
    });
  });
});
