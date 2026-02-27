/**
 * Format a phone number for display.
 * Handles E.164 (+15125551234), 11-digit (15125551234), and 10-digit (5125551234).
 * Returns "(512) 555-1234" for US numbers, or the original string if unrecognized.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return phone;
}
