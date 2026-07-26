// Helpers purs pour l'auth OTP (testables hors DOM/réseau).

/** Ne garde que les chiffres, max 6 (code OTP e-mail Supabase). */
export function normalizeOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/** Code complet = exactement 6 chiffres. */
export function isValidOtp(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** Validation e-mail volontairement permissive (le vrai contrôle est côté serveur). */
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ── Code d'invitation (lot Identité & accès, T3) ─────────────────────────────
// ⚠️ 10 SIGNES, pas 6. L'alphabet exclut les caractères ambigus (ni I, L, O, 0, 1) —
// il doit rester le MÊME que celui du générateur serveur (`functions/invite`), et la
// LONGUEUR ne doit pas bouger : la décision PO d'accepter `preview_invite` sans
// rate-limit repose explicitement sur « 10 signes × 31 ≈ 2⁴⁹ ».
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LEN = 10;

/** Majuscules, alphabet strict, longueur bornée (colle/saisie tolérantes). */
export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => INVITE_ALPHABET.includes(c))
    .join('')
    .slice(0, INVITE_CODE_LEN);
}

export function isValidInviteCode(code: string): boolean {
  return code.length === INVITE_CODE_LEN && [...code].every((c) => INVITE_ALPHABET.includes(c));
}
