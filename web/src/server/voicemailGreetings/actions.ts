"use server";

import { getOwnerBusinessContext } from "@/server/business/current";

import { validateVoicemailGreetingWav } from "./repository";

export type SetVoicemailGreetingAudioResult =
  | { status: "saved" }
  | { status: "cleared" }
  | { status: "business_not_found" }
  | { status: "invalid_audio"; error: "invalid_base64" | "file_too_large" | "invalid_wav" };

export async function setVoicemailGreetingAudio(
  businessId: string,
  base64Wav: string | null
): Promise<SetVoicemailGreetingAudioResult> {
  const context = await getOwnerBusinessContext();
  if (!context || context.business.id !== businessId) {
    return { status: "business_not_found" };
  }

  if (base64Wav === null) {
    await context.rt.voicemailGreetingRepository.deleteByBusinessId(businessId);
    return { status: "cleared" };
  }

  const validation = validateVoicemailGreetingWav(base64Wav);
  if (!validation.ok) {
    return { status: "invalid_audio", error: validation.error };
  }

  await context.rt.voicemailGreetingRepository.upsert({
    businessId,
    bytes: validation.bytes,
    contentType: validation.contentType
  });

  return { status: "saved" };
}
