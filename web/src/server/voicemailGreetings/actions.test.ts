import { describe, expect, it, beforeEach } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { setVoicemailGreetingAudio } from "./actions";

describe("setVoicemailGreetingAudio", () => {
  beforeEach(() => {
    resetIntakeRuntimeForTests();
  });

  it("saves and clears a valid base64 WAV greeting for a business", async () => {
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const bytes = makeWavBytes();

    const saved = await setVoicemailGreetingAudio(
      business.id,
      `data:audio/wav;base64,${Buffer.from(bytes).toString("base64")}`
    );

    expect(saved).toEqual({ status: "saved" });
    const stored = await runtime.voicemailGreetingRepository.findByBusinessId(business.id);
    expect(stored?.content_type).toBe("audio/wav");
    expect(Array.from(stored?.bytes ?? [])).toEqual(Array.from(bytes));

    const cleared = await setVoicemailGreetingAudio(business.id, null);

    expect(cleared).toEqual({ status: "cleared" });
    expect(await runtime.voicemailGreetingRepository.findByBusinessId(business.id)).toBeNull();
  });

  it("rejects invalid audio and unknown businesses", async () => {
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];

    await expect(setVoicemailGreetingAudio(business.id, "not-a-wav")).resolves.toEqual({
      status: "invalid_audio",
      error: "invalid_wav"
    });
    await expect(setVoicemailGreetingAudio("00000000-0000-4000-8000-999999999999", null)).resolves.toEqual({
      status: "business_not_found"
    });
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
