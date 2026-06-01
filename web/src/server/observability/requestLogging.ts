import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { captureException } from "./errorCapture";

export type RequestLogContext = {
  businessId?: string | null;
  providerCallId?: string | null;
  providerMessageId?: string | null;
  outcome?: string;
};

export type RequestLogger = {
  requestId: string;
  setContext(context: RequestLogContext): void;
};

export function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") ?? randomUUID();
}

export async function withRequestLogging(
  request: NextRequest,
  route: string,
  handler: (logger: RequestLogger) => Promise<Response>
): Promise<Response> {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const context: RequestLogContext = {};
  const logger: RequestLogger = {
    requestId,
    setContext(update) {
      Object.assign(context, update);
    }
  };

  try {
    const response = await handler(logger);
    response.headers.set("x-request-id", requestId);
    writeStructuredRequestLog({
      request,
      route,
      requestId,
      status: response.status,
      durationMs: Date.now() - startedAt,
      ...context
    });
    return response;
  } catch (error) {
    captureException(error, {
      requestId,
      route,
      outcome: "error",
      extra: {
        method: request.method
      }
    });
    writeStructuredRequestLog({
      request,
      route,
      requestId,
      status: 500,
      durationMs: Date.now() - startedAt,
      outcome: "error",
      ...context
    });
    throw error;
  }
}

export function writeStructuredRequestLog(input: {
  request: NextRequest;
  route: string;
  requestId: string;
  status: number;
  durationMs: number;
  businessId?: string | null;
  providerCallId?: string | null;
  providerMessageId?: string | null;
  outcome?: string;
}): void {
  const logLine = {
    event: "http.request",
    timestamp: new Date().toISOString(),
    request_id: input.requestId,
    method: input.request.method,
    route: input.route,
    status: input.status,
    outcome: input.outcome ?? statusToOutcome(input.status),
    duration_ms: input.durationMs,
    business_id: input.businessId ?? null,
    provider_call_id: input.providerCallId ?? null,
    provider_message_id: input.providerMessageId ?? null
  };

  console.info(JSON.stringify(logLine));
}

export function jsonResponseWithRequestId(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("x-request-id", getRequestId(request));
  return response;
}

function statusToOutcome(status: number): string {
  if (status >= 500) {
    return "error";
  }

  if (status >= 400) {
    return "rejected";
  }

  return "ok";
}
