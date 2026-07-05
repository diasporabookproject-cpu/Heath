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
