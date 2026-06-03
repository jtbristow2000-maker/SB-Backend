import type { BusinessRow, NumberPortRequestRow, NumberStatus } from "@/server/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NumberTrialState = {
  trialEndsAt: string;
  daysLeft: number;
  expired: boolean;
};

export type BusinessNumberReadModel = {
  number_status: NumberStatus;
  twilio_number_e164: string | null;
  twilio_number_sid: string | null;
  trial: NumberTrialState | null;
  port_request_status: NumberPortRequestRow["status"] | null;
};

export function getNumberTrialState(
  trialEndsAt: string | null,
  now: Date = new Date()
): NumberTrialState | null {
  if (!trialEndsAt) {
    return null;
  }

  const end = new Date(trialEndsAt);
  const diff = end.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diff / DAY_MS));

  return {
    trialEndsAt,
    daysLeft,
    expired: diff <= 0
  };
}

export function buildBusinessNumberReadModel(
  business: BusinessRow,
  portRequest?: NumberPortRequestRow | null,
  now: Date = new Date()
): BusinessNumberReadModel {
  return {
    number_status: business.number_status,
    twilio_number_e164: business.twilio_number_e164,
    twilio_number_sid: business.twilio_number_sid,
    trial: getNumberTrialState(business.number_trial_ends_at, now),
    port_request_status: portRequest?.status ?? null
  };
}
