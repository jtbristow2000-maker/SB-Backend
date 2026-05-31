import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export class PhoneNormalizationError extends Error {
  constructor(phone: string) {
    super(`Unable to normalize phone number: ${phone}`);
    this.name = "PhoneNormalizationError";
  }
}

export function normalizePhoneNumber(phone: string, defaultCountry: CountryCode = "US"): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    throw new PhoneNormalizationError(phone);
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed?.isValid()) {
    throw new PhoneNormalizationError(phone);
  }

  return parsed.number;
}
