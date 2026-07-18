/** No 0/O/1/I/L to keep references phone-friendly. */
export const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeReference(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  }
  return out;
}
