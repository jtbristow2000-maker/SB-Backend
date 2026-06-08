import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { GET } from "./route";

describe("GET /api/voicemail-greeting/[businessId]", () => {
  beforeEach(() => {
    resetIntakeRuntimeForTests();
  });

  it("serves the stored WAV greeting without authentication", async () => {
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const bytes = makeWavBytes();
    await runtime.voicemailGreetingRepository.upsert({
      businessId: business.id,
      bytes
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/voicemail-greeting/${business.id}`),
      { params: Promise.resolve({ businessId: business.id }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/wav");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it("returns 404 when no greeting exists", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/voicemail-greeting/missing"),
      { params: Promise.resolve({ businessId: "missing" }) }
    );

    expect(response.status).toBe(404);
  });
});

function makeWavBytes(): Uint8Array {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, 0, true);
  return bytes;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    bytes[offset + i] = value.charCodeAt(i);
  }
}
