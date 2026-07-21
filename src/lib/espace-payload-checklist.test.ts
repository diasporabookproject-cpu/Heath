import { describe, expect, it, vi } from 'vitest';

// T3 (lot partage) — le PAYLOAD ne porte `cl`/`tasks` QUE si la personne a la
// checklist active (patron gouter? : champs ABSENTS sinon — pas null, ABSENTS —
// pour qu'une page « avant » et une page « checklist off » soient identiques).

vi.mock('./db', () => ({
  loadAudio: async () => null,
  loadFoyerRegles: async () => null,
  loadSecurite: async () => [],
  recordPublished: async () => undefined,
}));
vi.mock('./publish', () => ({
  getAccessToken: async () => 'tok',
  uploadAudios: async () => new Map(),
  uploadWeekAudios: async () => new Map(),
}));
vi.mock('./ai', () => ({ translateToDarija: async () => null }));
vi.mock('./supabase', () => ({ getSupabase: () => null }));
vi.mock('./auth', () => ({ currentFoyerId: async () => null }));

import { previewEspace } from './espace';
import type { AppConfig, Destinataire, WeekMenu } from '../types';

const CONFIG: AppConfig = { jours: [{ key: 'lun', nom: 'Lundi' }] };
const WEEK: WeekMenu = {
  id: 'current',
  days: {
    lun: {
      petitdej: { plat: null },
      dej: { plat: null, entree: null, acc: null },
      gouter: { plat: null },
      diner: { plat: null, entree: null, acc: null },
    },
  },
};

const dest = (over: Partial<Destinataire>): Destinataire => ({
  id: 'd1',
  nom: 'Fatima',
  role: 'Cuisine',
  langue: 'fr',
  token: 't0k',
  createdAt: 0,
  ...over,
});

describe('payload — champs checklist conditionnels (lien perpétuel)', () => {
  it('checklist OFF → ni `cl` ni `tasks` (champs ABSENTS, pas null)', async () => {
    const p = await previewEspace(dest({}), CONFIG, WEEK, new Map());
    expect('cl' in p).toBe(false);
    expect('tasks' in p).toBe(false);
  });

  it('checklist ON → cl: 1 + tasks nettoyées (les vides filtrées)', async () => {
    const p = await previewEspace(
      dest({ checklist: true, tasks: [{ id: 'a', t: 'Nettoyer le salon' }, { id: 'b', t: '   ' }] }),
      CONFIG,
      WEEK,
      new Map(),
    );
    expect(p.cl).toBe(1);
    expect(p.tasks).toEqual([{ id: 'a', t: 'Nettoyer le salon' }]);
  });
});
