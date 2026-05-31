import { NextRequest, NextResponse } from "next/server";

export const API_KEY_HEADER = "x-api-key";

export function requireApiKey(request: NextRequest): NextResponse | null {
  const expected = process.env.API_KEY;
  if (!expected) {
    return NextResponse.json(
      {
        error: "api_key_not_configured",
        message: "API_KEY must be configured before protected API routes are available."
      },
      { status: 503 }
    );
  }

  const provided = request.headers.get(API_KEY_HEADER);
  if (provided !== expected) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Missing or invalid API key."
      },
      { status: 401 }
    );
  }

  return null;
}
