import { describe, expect, it } from "vitest";

import { quotePriceLabel, type QuoteRangeSettings } from "@/server/business/settings";

describe("business settings quote helpers", () => {
  const ranges: QuoteRangeSettings[] = [
    { service: "Full Detail", low: 225, high: 325 },
    { service: "Interior Detail", low: 150, high: 150 },
    { service: "Ceramic Coating", low: 1200, high: 1800 }
  ];

  it("prefers an exact service match over a substring match", () => {
    expect(
      quotePriceLabel("full detail", [
        { service: "Detail", low: 99, high: 199 },
        { service: "Full Detail", low: 225, high: 325 }
      ])
    ).toBe("$225\u2013$325");
  });

  it("falls back to substring matching either way", () => {
    expect(quotePriceLabel("Full Detail SUV", ranges)).toBe("$225\u2013$325");
    expect(quotePriceLabel("Interior", ranges)).toBe("$150");
  });

  it("formats flat and ranged prices with thousands separators", () => {
    expect(quotePriceLabel("Interior Detail", ranges)).toBe("$150");
    expect(quotePriceLabel("Ceramic Coating", ranges)).toBe("$1,200\u2013$1,800");
  });

  it("returns null when no quote can be matched", () => {
    expect(quotePriceLabel(null, ranges)).toBeNull();
    expect(quotePriceLabel("Window tint", ranges)).toBeNull();
    expect(quotePriceLabel("Full Detail", [])).toBeNull();
  });
});
