import { NextRequest, NextResponse } from "next/server";

export const INTERNAL_JOB_TOKEN_HEADER = "x-internal-job-token";

export function requireInternalJobToken(request: NextRequest): NextResponse | null {
  const expected = process.env.INTERNAL_JOB_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      {
        error: "internal_job_token_not_configured",
        message: "INTERNAL_JOB_TOKEN must be configured before internal jobs are available."
      },
      { status: 503 }
    );
  }

  const provided =
    request.headers.get(INTERNAL_JOB_TOKEN_HEADER)?.trim() ??
    readBearerToken(request.headers.get("authorization"));

  if (provided !== expected) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Missing or invalid internal job token."
      },
      { status: 401 }
    );
  }

  return null;
}

function readBearerToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}
