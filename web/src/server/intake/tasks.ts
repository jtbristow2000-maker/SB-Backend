import { randomUUID } from "node:crypto";

import type { TaskRow } from "@/server/db/schema";

export type TaskCreateInput = {
  business_id: string;
  customer_profile_id?: string | null;
  task_type: string;
  title: string;
  notes?: string | null;
  due_at?: string | null;
  status?: TaskRow["status"];
};

export interface TaskRepository {
  create(input: TaskCreateInput): Promise<TaskRow>;
  list(): Promise<TaskRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, TaskRow>();

  async create(input: TaskCreateInput): Promise<TaskRow> {
    const timestamp = nowIso();
    const task: TaskRow = {
      id: randomUUID(),
      business_id: input.business_id,
      customer_profile_id: input.customer_profile_id ?? null,
      task_type: input.task_type,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at ?? null,
      status: input.status ?? "open",
      created_at: timestamp,
      updated_at: timestamp
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async list(): Promise<TaskRow[]> {
    return Array.from(this.tasks.values());
  }
}
