import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decideEspaceState, readEspace } from './espace';
import { getSupabase } from './supabase';

// ④ (audit §7.8) — une page RÉVOQUÉE ne doit plus être servie depuis le cache.
// Complément CLIENT de F1 (qui a coupé le lien côté serveur).

vi.mock('./supabase', () => ({ getSupabase: vi.fn() }));

describe('decideEspaceState — le cache d’une page révoquée est coupé', () => {
  it('révoqué → écran « retiré », MÊME si un cache existe (le trou fermé)', () => {
    expect(decideEspaceState('revoked', true)).toBe('revoked');
    expect(decideEspaceState('revoked', false)).toBe('revoked');
  });

  it('offline (injoignable) + cache → sert le cache (offline LÉGITIME préservé)', () => {
    expect(decideEspaceState('unreachable', true)).toBe('page-cache');
  });

  it('offline sans cache → écran hors-ligne', () => {
    expect(decideEspaceState('unreachable', false)).toBe('offline');
  });

  it('trouvé → page live (peu importe le cache)', () => {
    expect(decideEspaceState('found', true)).toBe('page-live');
    expect(decideEspaceState('found', false)).toBe('page-live');
  });
});

describe('readEspace — distingue révoqué (0 ligne) de injoignable (erreur)', () => {
  function supaMock(res: { data?: unknown; error?: unknown }) {
    const maybeSingle = vi.fn().mockResolvedValue(res);
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    return { from: vi.fn(() => ({ select })) };
  }
  beforeEach(() => vi.mocked(getSupabase).mockReset());

  it('pas de client → unreachable (le cache reste légitime)', async () => {
    vi.mocked(getSupabase).mockReturnValue(null as never);
    expect((await readEspace('t')).status).toBe('unreachable');
  });

  it('erreur réseau → unreachable (surtout PAS révoqué)', async () => {
    vi.mocked(getSupabase).mockReturnValue(supaMock({ error: { message: 'network' } }) as never);
    expect((await readEspace('t')).status).toBe('unreachable');
  });

  it('requête OK, 0 ligne → revoked (la ligne a été supprimée par F1)', async () => {
    vi.mocked(getSupabase).mockReturnValue(supaMock({ data: null }) as never);
    expect((await readEspace('t')).status).toBe('revoked');
  });

  it('payload présent → found', async () => {
    vi.mocked(getSupabase).mockReturnValue(supaMock({ data: { payload: { v: 1 } } }) as never);
    const r = await readEspace('t');
    expect(r.status).toBe('found');
    expect(r.status === 'found' && r.espace).toEqual({ v: 1 });
  });
});
