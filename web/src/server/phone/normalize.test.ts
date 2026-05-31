import { describe, expect, it } from "vitest";

import { normalizePhoneNumber, PhoneNormalizationError } from "./normalize";

describe("BACKEND-05 phone normalization", () => {
  it("normalizes US local formatting into E.164", () => {
    expect(normalizePhoneNumber("(213) 373-4253")).toBe("+12133734253");
  });

  it("keeps valid E.164 numbers stable", () => {
    expect(normalizePhoneNumber("+12133734253")).toBe("+12133734253");
  });

  it("rejects invalid phone values", () => {
    expect(() => normalizePhoneNumber("not a phone")).toThrow(PhoneNormalizationError);
  });
});
