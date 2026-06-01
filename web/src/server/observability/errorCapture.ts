import { randomUUID } from "node:crypto";

export type ErrorCaptureContext = {
  requestId?: string;
  route?: string;
  outcome?: string;
  extra?: Record<string, unknown>;
};

export function isErrorCaptureEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

export function captureException(error: unknown, context: ErrorCaptureContext = {}): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  const endpoint = parseSentryDsn(dsn);
  if (!endpoint) {
    return;
  }

  const errorObject = error instanceof Error ? error : new Error(String(error));
  const event = {
    event_id: randomUUID().replaceAll("-", ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    logger: "sb-web",
    message: errorObject.message,
    exception: {
      values: [
        {
          type: errorObject.name,
          value: errorObject.message,
          stacktrace: errorObject.stack
        }
      ]
    },
    tags: {
      request_id: context.requestId,
      route: context.route,
      outcome: context.outcome
    },
    extra: context.extra ?? {}
  };

  void fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(event),
    keepalive: true
  }).catch(() => {
    // Error capture must never break request handling.
  });
}

function parseSentryDsn(dsn: string): string | null {
  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const projectId = pathParts.pop();
    const pathPrefix = pathParts.length > 0 ? `/${pathParts.join("/")}` : "";

    if (!publicKey || !projectId) {
      return null;
    }

    const endpoint = new URL(`${pathPrefix}/api/${projectId}/store/`, parsed.origin);
    endpoint.searchParams.set("sentry_key", publicKey);
    endpoint.searchParams.set("sentry_version", "7");
    return endpoint.toString();
  } catch {
    return null;
  }
}
