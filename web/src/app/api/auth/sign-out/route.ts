import { NextRequest } from "next/server";

import { handleSignOut } from "@/server/auth/passwordAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}
