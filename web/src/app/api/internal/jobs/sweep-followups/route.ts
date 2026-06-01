import { NextRequest, NextResponse } from "next/server";

import { requireInternalJobToken } from "@/server/auth/internalJob";
import { getIntakeRuntime } from "@/server/intake/runtime";
import { getFollowUpStaleHours, sweepFollowUps } from "@/server/jobs/followups";
import { withRequestLogging } from "@/server/observability/requestLogging";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withRequestLogging(
    request,
    "/api/internal/jobs/sweep-followups",
    async (logger) => {
      const authError = requireInternalJobToken(request);
      if (authError) {
        logger.setContext({ outcome: "unauthorized" });
        return authError;
      }

      const intake = await getIntakeRuntime();
      const business = (await intake.businessRepository.list())[0] ?? null;

      if (!business) {
        logger.setContext({ outcome: "no_business" });
        return NextResponse.json({
          scanned: 0,
          stale: 0,
          created: 0,
          skipped_existing_today: 0,
          tasks: []
        });
      }

      const result = await sweepFollowUps(
        {
          customerProfileRepository: intake.customerProfileRepository,
          messageRepository: intake.messageRepository,
          taskRepository: intake.taskRepository,
          auditEventRepository: intake.auditEventRepository
        },
        {
          businessId: business.id,
          staleAfterHours: getFollowUpStaleHours()
        }
      );

      logger.setContext({ businessId: business.id, outcome: "ok" });
      return NextResponse.json(result);
    }
  );
}
