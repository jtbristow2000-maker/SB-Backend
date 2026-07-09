import type { BusinessRepository } from "@/server/business/bootstrap";
import type { CustomerProfileRepository } from "@/server/customerProfiles/repository";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import type { BusinessRow, CustomerProfileRow, JsonValue } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";

export type InboundBusinessMatch = {
  business: BusinessRow;
  matchedBy: "twilio_number" | "business_phone" | "shared_forward";
};

export type InboundSmsBusinessMatch = {
  business: BusinessRow;
  matchedBy: "twilio_number" | "business_phone" | "shared_sms_profile";
  customerProfile?: CustomerProfileRow;
};

export async function resolveBusinessByInboundPhone(
  businessRepository: BusinessRepository,
  phoneE164: string,
  options: {
    auditEventRepository?: AuditEventRepository;
    collisionRoute?: string;
  } = {}
): Promise<InboundBusinessMatch | null> {
  const twilioNumberBusiness = await businessRepository.findByTwilioNumber(phoneE164);
  if (twilioNumberBusiness) {
    return { business: twilioNumberBusiness, matchedBy: "twilio_number" };
  }

  const bootstrapPhoneBusiness = await findBusinessByBusinessPhoneDeterministic(
    businessRepository,
    phoneE164,
    options
  );
  return bootstrapPhoneBusiness
    ? { business: bootstrapPhoneBusiness, matchedBy: "business_phone" }
    : null;
}

export async function resolveBusinessForIncomingVoice(input: {
  businessRepository: BusinessRepository;
  auditEventRepository?: AuditEventRepository;
  toE164: string;
  called?: string | null;
  forwardedFrom?: string | null;
  calledVia?: string | null;
  sharedNumberE164?: string | null;
  rawPayload?: Record<string, string | null | undefined>;
}): Promise<InboundBusinessMatch | null> {
  const sharedInbound = isSharedInboundPhone(input.toE164, input.called, input.sharedNumberE164);
  if (!sharedInbound) {
    return resolveBusinessByInboundPhone(input.businessRepository, input.toE164, {
      auditEventRepository: input.auditEventRepository,
      collisionRoute: "voice.inbound"
    });
  }

  const forwardedRaw = input.forwardedFrom?.trim() || input.calledVia?.trim() || null;
  const forwardedPhone = normalizePhoneOrNull(forwardedRaw);
  if (!forwardedPhone) {
    emitSharedRoutingWarning("voice.shared_unmatched", {
      reason: forwardedRaw ? "invalid_forwarded_from" : "missing_forwarded_from",
      to: input.toE164,
      called: input.called ?? null,
      forwardedFrom: input.forwardedFrom ?? null,
      calledVia: input.calledVia ?? null,
      sharedNumberE164: input.sharedNumberE164 ?? null,
      rawPayload: scrubRoutingPayload(input.rawPayload)
    });
    return null;
  }

  const business = await findBusinessByBusinessPhoneDeterministic(
    input.businessRepository,
    forwardedPhone,
    {
      auditEventRepository: input.auditEventRepository,
      collisionRoute: "voice.shared_forward"
    }
  );
  if (!business) {
    emitSharedRoutingWarning("voice.shared_unmatched", {
      reason: "forwarded_from_unmatched",
      to: input.toE164,
      forwardedFrom: input.forwardedFrom ?? null,
      calledVia: input.calledVia ?? null,
      forwardedFromE164: forwardedPhone,
      sharedNumberE164: input.sharedNumberE164 ?? null,
      rawPayload: scrubRoutingPayload(input.rawPayload)
    });
    return null;
  }

  return { business, matchedBy: "shared_forward" };
}

export async function resolveBusinessForInboundSms(input: {
  businessRepository: BusinessRepository;
  customerProfileRepository: CustomerProfileRepository;
  auditEventRepository?: AuditEventRepository;
  fromE164: string;
  toE164: string;
  sharedNumberE164?: string | null;
}): Promise<InboundSmsBusinessMatch | null> {
  if (!isSamePhone(input.toE164, input.sharedNumberE164)) {
    const match = await resolveBusinessByInboundPhone(input.businessRepository, input.toE164, {
      auditEventRepository: input.auditEventRepository,
      collisionRoute: "sms.inbound"
    });
    return match
      ? {
          business: match.business,
          matchedBy: match.matchedBy === "twilio_number" ? "twilio_number" : "business_phone"
        }
      : null;
  }

  const matches = (await input.customerProfileRepository.list())
    .filter((profile) => profile.phone_e164 === input.fromE164)
    .sort(compareProfilesByRecency);
  const selectedProfile = matches[0] ?? null;
  if (!selectedProfile) {
    emitSharedRoutingWarning("sms.shared_unmatched", {
      reason: "sender_profile_unmatched",
      from: input.fromE164,
      to: input.toE164,
      sharedNumberE164: input.sharedNumberE164 ?? null
    });
    return null;
  }

  const business = await input.businessRepository.findById(selectedProfile.business_id);
  if (!business) {
    emitSharedRoutingWarning("sms.shared_unmatched", {
      reason: "matched_profile_business_missing",
      from: input.fromE164,
      to: input.toE164,
      customerProfileId: selectedProfile.id,
      businessId: selectedProfile.business_id,
      sharedNumberE164: input.sharedNumberE164 ?? null
    });
    return null;
  }

  const businessIds = new Set(matches.map((profile) => profile.business_id));
  if (businessIds.size > 1) {
    await createAuditEventSafe(input.auditEventRepository, {
      business_id: business.id,
      customer_profile_id: selectedProfile.id,
      actor: "system",
      event_type: "sms.shared_ambiguous",
      event_json: {
        fromPhoneE164: input.fromE164,
        toPhoneE164: input.toE164,
        selectedProfileId: selectedProfile.id,
        selectedBusinessId: business.id,
        matchedProfileIds: matches.map((profile) => profile.id),
        matchedBusinessIds: Array.from(businessIds)
      }
    });
  }

  return { business, customerProfile: selectedProfile, matchedBy: "shared_sms_profile" };
}

export function resolveOutboundNumber(
  business: Pick<BusinessRow, "twilio_number_e164">,
  config: { sharedNumberE164?: string | null }
): string | null {
  return business.twilio_number_e164 ?? config.sharedNumberE164 ?? null;
}

export function isSharedInboundPhone(
  toE164: string,
  called: string | null | undefined,
  sharedNumberE164: string | null | undefined
): boolean {
  if (!sharedNumberE164) {
    return false;
  }

  const calledE164 = normalizePhoneOrNull(called);
  return toE164 === sharedNumberE164 || calledE164 === sharedNumberE164;
}

async function findBusinessByBusinessPhoneDeterministic(
  businessRepository: BusinessRepository,
  phoneE164: string,
  options: {
    auditEventRepository?: AuditEventRepository;
    collisionRoute?: string;
  } = {}
): Promise<BusinessRow | null> {
  const matches = (await businessRepository.list())
    .filter((business) => business.business_phone_e164 === phoneE164)
    .sort(compareBusinessesByUpdatedAt);
  const selected = matches[0] ?? null;
  if (matches.length > 1 && selected) {
    await createAuditEventSafe(options.auditEventRepository, {
      business_id: selected.id,
      actor: "system",
      event_type: "business_phone.collision",
      event_json: {
        phoneE164,
        route: options.collisionRoute ?? "inbound",
        selectedBusinessId: selected.id,
        matchedBusinessIds: matches.map((business) => business.id)
      }
    });
  }

  return selected;
}

function compareBusinessesByUpdatedAt(a: BusinessRow, b: BusinessRow): number {
  const byUpdated = Date.parse(b.updated_at) - Date.parse(a.updated_at);
  return byUpdated !== 0 ? byUpdated : b.id.localeCompare(a.id);
}

function compareProfilesByRecency(a: CustomerProfileRow, b: CustomerProfileRow): number {
  const aTime = Date.parse(a.last_contact_at ?? a.updated_at ?? a.created_at);
  const bTime = Date.parse(b.last_contact_at ?? b.updated_at ?? b.created_at);
  const byTime = bTime - aTime;
  return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
}

function normalizePhoneOrNull(phone: string | null | undefined): string | null {
  if (!phone?.trim()) {
    return null;
  }

  try {
    return normalizePhoneNumber(phone);
  } catch {
    return null;
  }
}

function isSamePhone(phoneE164: string, maybePhone: string | null | undefined): boolean {
  return Boolean(maybePhone && phoneE164 === maybePhone);
}

function scrubRoutingPayload(
  payload: Record<string, string | null | undefined> | undefined
): JsonValue {
  if (!payload) {
    return {};
  }

  const cleaned: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" && value.trim()) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

async function createAuditEventSafe(
  auditEventRepository: AuditEventRepository | undefined,
  input: Parameters<AuditEventRepository["create"]>[0]
): Promise<void> {
  if (!auditEventRepository) {
    emitSharedRoutingWarning(input.event_type, input.event_json ?? {});
    return;
  }

  try {
    await auditEventRepository.create(input);
  } catch (error) {
    emitSharedRoutingWarning(`${input.event_type}.audit_failed`, {
      businessId: input.business_id,
      error: error instanceof Error ? error.message : "unknown",
      eventJson: input.event_json ?? null
    });
  }
}

function emitSharedRoutingWarning(event: string, payload: JsonValue): void {
  console.warn(
    JSON.stringify({
      event,
      ...(typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? payload
        : { payload })
    })
  );
}
