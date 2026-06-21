import { describe, expect, it } from 'vitest';
import { buildSharePayload, decodeMenu, encodeMenu } from './share';
import { SEED_CONFIG, SEED_RECIPES } from '../data';
import type { Recipe, WeekMenu } from '../types';

const byId = new Map<string, Recipe>(SEED_RECIPES.map((r) => [r.id, r]));

describe('partage par lien', () => {
  const week: WeekMenu = {
    id: 'current',
    days: {
      lun: { dejId: 'DEJ-07', dinId: 'DIN-01', extras: ['CF-04'] },
      mar: { dejId: null, dinId: null, extras: [] },
    },
  };

  it('encode puis décode sans perte', () => {
    const payload = buildSharePayload(SEED_CONFIG, week, byId, new Set(['DEJ-07']));
    const round = decodeMenu(encodeMenu(payload));
    expect(round).toEqual(payload);
  });

  it("n'inclut que les jours non vides", () => {
    const payload = buildSharePayload(SEED_CONFIG, week, byId, new Set());
    expect(payload.days.map((d) => d.k)).toEqual(['lun']);
    expect(payload.days[0].dej?.n).toMatch(/Bowl poulet épinards/);
    expect(payload.days[0].ex?.length).toBe(1);
  });

  it('marque les notes vocales (placeholder)', () => {
    const payload = buildSharePayload(SEED_CONFIG, week, byId, new Set(['DEJ-07']));
    expect(payload.days[0].dej?.v).toBe(1);
    expect(payload.days[0].din?.v).toBeUndefined();
  });

  it('rejette un contenu invalide', () => {
    expect(decodeMenu('nimporte-quoi')).toBeNull();
  });

  it('intègre les URLs audio (menu publié) sinon un placeholder', () => {
    const urls = new Map([['DEJ-07', 'https://x.supabase.co/storage/v1/object/public/shared/a/DEJ-07.webm']]);
    const payload = buildSharePayload(SEED_CONFIG, week, byId, new Set(['DEJ-07']), urls);
    expect(payload.days[0].dej?.a).toContain('DEJ-07.webm');
    expect(payload.days[0].dej?.v).toBeUndefined(); // a remplace v
    // round-trip conserve l'URL
    expect(decodeMenu(encodeMenu(payload))?.days[0].dej?.a).toBe(payload.days[0].dej?.a);
  });

  it('garde le lien raisonnablement court (semaine complète)', () => {
    const full: WeekMenu = { id: 'c', days: {} };
    const ids = ['DEJ-01', 'DEJ-02', 'DEJ-03', 'DEJ-07', 'DEJ-08', 'DEJ-06', 'DEJ-09'];
    const dins = ['DIN-01', 'DIN-02', 'DIN-03', 'DIN-04', 'DIN-05', 'DIN-06', 'DIN-07'];
    SEED_CONFIG.jours.forEach((j, i) => {
      full.days[j.key] = { dejId: ids[i], dinId: dins[i], extras: [] };
    });
    const enc = encodeMenu(buildSharePayload(SEED_CONFIG, full, byId, new Set()));
    // base de l'URL ~50 car. ; on veut rester bien en dessous des limites WhatsApp.
    expect(enc.length).toBeLessThan(6000);
  });
});
