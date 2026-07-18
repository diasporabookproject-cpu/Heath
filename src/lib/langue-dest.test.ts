import { describe, expect, it } from 'vitest';
import { normalizeDestLangue, normalizeDestinataire, wireLangue, type Destinataire } from '../types';
import { cuisineSig } from '../maison/transmission';
import { hashStr } from './hash';
import type { WeekMenu } from '../types';

// T2 (mini-lot destinataires) — remappage 'ar' → 'dr'.
// D6 (sémantique, fixée ICI) : 'fr' = français · 'dr' = darija marocaine ·
// 'ar' = arabe standard moderne (fusha, libellé « Arabe classique ») · 'en' = anglais.
// Côté Cuisine, l'ancien 'ar' SIGNIFIAIT darija → migré ; sur le FIL v:1, la
// darija reste 'ar' pour toujours (liens distribués perpétuels).

const dest = (langue: string): Destinataire =>
  ({ id: 'i', nom: 'Fatima', role: 'Cuisine', langue, token: 't', createdAt: 1 }) as Destinataire;

describe('remappage langue (T2) — migration idempotente', () => {
  it("'ar' legacy → 'dr' ; 'dr' et 'fr' inchangés ; inconnu → 'fr' (sûr)", () => {
    expect(normalizeDestLangue('ar')).toBe('dr');
    expect(normalizeDestLangue('dr')).toBe('dr');
    expect(normalizeDestLangue('fr')).toBe('fr');
    expect(normalizeDestLangue('xx')).toBe('fr');
  });

  it('idempotente : normaliser deux fois = normaliser une fois', () => {
    const once = normalizeDestinataire(dest('ar'));
    expect(once.langue).toBe('dr');
    expect(normalizeDestinataire(once)).toBe(once); // même référence : rien à réécrire
  });

  it('un destinataire déjà propre est rendu TEL QUEL (pas de réécriture IDB inutile)', () => {
    const clean = dest('dr');
    expect(normalizeDestinataire(clean)).toBe(clean);
  });
});

describe('wireLangue — le contrat du fil v:1', () => {
  it("la darija voyage en 'ar' (perpétuel), le français en 'fr'", () => {
    expect(wireLangue('dr')).toBe('ar');
    expect(wireLangue('fr')).toBe('fr');
  });
});

describe('cuisineSig — stable à travers la migration (les cartes ne basculent pas)', () => {
  it("signature du code MIGRÉ ('dr') = signature de l'ANCIEN code ('ar' brut) : la PAGE n'a pas changé", () => {
    const week = { days: [] } as unknown as WeekMenu;
    // L'ancien code signait la langue BRUTE du destinataire ('ar' = darija legacy).
    const ancienne = hashStr(JSON.stringify({ d: week.days, l: 'ar', p: 4, s: [] }));
    // Le nouveau signe la langue du FIL — pour un migré 'dr', c'est encore 'ar'.
    const nouvelle = cuisineSig(week, 4, normalizeDestinataire(dest('ar')));
    expect(nouvelle).toBe(ancienne);
  });
});
