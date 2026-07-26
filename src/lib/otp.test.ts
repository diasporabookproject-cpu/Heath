import { describe, expect, it } from 'vitest';
import { normalizeOtp, isValidOtp, isValidEmail, normalizeInviteCode, isValidInviteCode } from './otp';

describe('otp', () => {
  it('normalizeOtp ne garde que les chiffres, max 6', () => {
    expect(normalizeOtp('123 456')).toBe('123456');
    expect(normalizeOtp('12-34-56-78')).toBe('123456');
    expect(normalizeOtp('abc12')).toBe('12');
    expect(normalizeOtp('')).toBe('');
  });

  it('isValidOtp = exactement 6 chiffres', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('1234567')).toBe(false);
    expect(isValidOtp('12a456')).toBe(false);
  });

  it('isValidEmail permissif mais rejette l’évident', () => {
    expect(isValidEmail('toi@exemple.com')).toBe(true);
    expect(isValidEmail('  a@b.co ')).toBe(true);
    expect(isValidEmail('pas-un-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('code d’invitation — 10 signes, alphabet sans ambiguïté', () => {
  it('normalise : majuscules, rejette les caractères ambigus, borne à 10', () => {
    expect(normalizeInviteCode('4k7p2m-abc')).toBe('4K7P2MABC');   // tiret retiré
    expect(normalizeInviteCode('io01')).toBe('');                   // I, O, 0, 1 exclus
    expect(normalizeInviteCode('ABCDEFGHJKMNPQ')).toHaveLength(10); // borné
  });

  it('valide seulement un code COMPLET de 10 signes', () => {
    expect(isValidInviteCode('ABCDEFGHJK')).toBe(true);
    expect(isValidInviteCode('ABCDEF')).toBe(false);  // 6 = le code de la maquette, pas le vrai
    expect(isValidInviteCode('ABCDEFGHI0')).toBe(false); // I et 0 hors alphabet
  });
});
