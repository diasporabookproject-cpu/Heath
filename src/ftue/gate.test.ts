import { describe, expect, it } from 'vitest';
import { gateMode, type GateInput } from './gate';

// Lot Identité & accès T1 — le mur. Ces tests portent les DEUX invariants du gate :
// le personnel n'est jamais muré, et le hors-ligne n'enferme jamais dehors.

const base: GateInput = {
  espaceToken: false,
  demo: false,
  compteLie: false,
  ftueDone: false,
  bootedBefore: false,
};

describe('gate — le compte est requis', () => {
  it('appareil vierge → l’Écran 1, jamais la FTUE', () => {
    expect(gateMode(base)).toBe('entrer');
  });

  it('même un appareil DÉJÀ PEUPLÉ passe par le compte (il n’y a plus de mode sans compte)', () => {
    expect(gateMode({ ...base, bootedBefore: true, ftueDone: true })).toBe('entrer');
  });

  it('compte lié + FTUE faite → l’app', () => {
    expect(gateMode({ ...base, compteLie: true, ftueDone: true })).toBe('app');
  });

  it('compte lié, FTUE à faire → la FTUE (le foyer vient APRÈS le compte)', () => {
    expect(gateMode({ ...base, compteLie: true })).toBe('ftue');
  });

  it('compte lié, appareil pré-FTUE → migration one-shot, jamais la FTUE', () => {
    expect(gateMode({ ...base, compteLie: true, bootedBefore: true })).toBe('migrer');
  });
});

describe('gate — invariant ① : le personnel n’est JAMAIS muré', () => {
  it('un lien reçu court-circuite le mur (destinataire sans compte)', () => {
    expect(gateMode({ ...base, espaceToken: true })).toBe('app');
  });

  it('le lien gagne même sur un appareil totalement vierge', () => {
    expect(gateMode({ espaceToken: true, demo: false, compteLie: false, ftueDone: false, bootedBefore: false })).toBe('app');
  });

  it('la vitrine #mz-demo reste accessible', () => {
    expect(gateMode({ ...base, demo: true })).toBe('app');
  });
});

describe('gate — invariant ② : hors-ligne n’est pas déconnecté', () => {
  // Le gate ne prend PAS la session en entrée : c'est le cœur de la parade.
  // Hors-ligne, `getSession()` rend null dès le jeton d'accès expiré (1 h) ; si le
  // gate en dépendait, l'utilisateur se retrouverait devant un mur qu'il ne peut pas
  // franchir sans réseau. Ici, `compteLie` seul décide.
  it('compte lié → l’app s’ouvre, quelle que soit la santé du réseau', () => {
    const horsLigne = { ...base, compteLie: true, ftueDone: true };
    expect(gateMode(horsLigne)).toBe('app');
    // Et c'est vrai indéfiniment : aucune entrée du gate ne se périme.
    expect(gateMode({ ...horsLigne, bootedBefore: true })).toBe('app');
  });

  it('la déconnexion (drapeau effacé) referme le mur', () => {
    expect(gateMode({ ...base, compteLie: false, ftueDone: true })).toBe('entrer');
  });
});
