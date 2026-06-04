import { NextRequest } from "next/server";

import { handlePasswordSignIn } from "@/server/auth/passwordAuth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handlePasswordSignIn(request);
}
