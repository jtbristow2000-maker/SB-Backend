import { describe, expect, it } from "vitest";

import { getNumberTrialState } from "./numberState";

describe("business number trial state", () => {
  it("computes days left and expiry from the trial end timestamp", () => {
    expect(
      getNumberTrialState(
        "2026-06-17T12:00:00.000Z",
        new Date("2026-06-03T12:00:00.000Z")
      )
    ).toEqual({
      trialEndsAt: "2026-06-17T12:00:00.000Z",
      daysLeft: 14,
      expired: false
    });

    expect(
      getNumberTrialState(
        "2026-06-03T11:59:59.000Z",
        new Date("2026-06-03T12:00:00.000Z")
      )
    ).toMatchObject({ daysLeft: 0, expired: true });
  });
});
