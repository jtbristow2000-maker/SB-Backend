import type { BusinessRepository } from "@/server/business/bootstrap";
import type { BusinessRow } from "@/server/db/schema";

export type InboundBusinessMatch = {
  business: BusinessRow;
  matchedBy: "twilio_number" | "business_phone";
};

export async function resolveBusinessByInboundPhone(
  businessRepository: BusinessRepository,
  phoneE164: string
): Promise<InboundBusinessMatch | null> {
  const twilioNumberBusiness = await businessRepository.findByTwilioNumber(phoneE164);
  if (twilioNumberBusiness) {
    return { business: twilioNumberBusiness, matchedBy: "twilio_number" };
  }

  const bootstrapPhoneBusiness = await businessRepository.findByBusinessPhone(phoneE164);
  return bootstrapPhoneBusiness
    ? { business: bootstrapPhoneBusiness, matchedBy: "business_phone" }
    : null;
}
