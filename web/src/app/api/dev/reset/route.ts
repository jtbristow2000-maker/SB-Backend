import { NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";
import { resetIntakeRuntimeForTests } from "@/server/intake/runtime";

export const runtime = "nodejs";

// Dev/sandbox-only: clears the in-memory intake state so the console can start fresh.
export async function POST() {
  if (!getAppConfig().sandboxMode) {
    return NextResponse.json({ error: "dev console disabled outside sandbox" }, { status: 404 });
  }

  resetIntakeRuntimeForTests();
  return NextResponse.json({ ok: true });
}
