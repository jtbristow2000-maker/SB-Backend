import { NextRequest } from "next/server";

import { handlePasswordSignUp } from "@/server/auth/passwordAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handlePasswordSignUp(request);
}
