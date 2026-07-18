import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revokeEspace } from './espace';
import { getSupabase } from './supabase';

// F1 (mini-lot destinataires) — la SÉMANTIQUE du revoke honnête :
// succès = le serveur a répondu sans erreur (jamais le rowcount) ;
// échec = on ne l'a pas joint (client absent, session absente, erreur).
// La session est exigée AVANT l'appel : la policy delete (0006) est
// `to authenticated` — sans session, RLS filtrerait en silence (faux succès).

vi.mock('./supabase', () => ({ getSupabase: vi.fn() }));

function supaMock(opts: { session: boolean; deleteError?: unknown }) {
  const eq = vi.fn().mockResolvedValue({ error: opts.deleteError ?? null });
  const del = vi.fn(() => ({ eq }));
  return {
    client: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: opts.session ? {} : null } }) },
      from: vi.fn(() => ({ delete: del })),
    },
    eq,
  };
}

beforeEach(() => vi.mocked(getSupabase).mockReset());

describe('lib/espace — revokeEspace honnête (F1)', () => {
  it('client absent → refus « session », AUCUN appel serveur', async () => {
    vi.mocked(getSupabase).mockReturnValue(null as never);
    expect(await revokeEspace('tok')).toEqual({ error: 'session' });
  });

  it('session absente → refus « session » AVANT le DELETE (RLS filtrerait en silence)', async () => {
    const m = supaMock({ session: false });
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    expect(await revokeEspace('tok')).toEqual({ error: 'session' });
    expect(m.eq).not.toHaveBeenCalled();
  });

  it('erreur du DELETE → « serveur » (le toast menteur est mort)', async () => {
    const m = supaMock({ session: true, deleteError: { message: 'boom' } });
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    expect(await revokeEspace('tok')).toEqual({ error: 'serveur' });
  });

  it('serveur répondu sans erreur → succès — 0 ligne = « rien à couper », jamais le rowcount', async () => {
    // Le mock ne fournit AUCUN rowcount : si l'implémentation en dépendait,
    // ce test la verrait échouer. Une personne jamais partagée reste retirable.
    const m = supaMock({ session: true });
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    expect(await revokeEspace('tok')).toEqual({});
    expect(m.eq).toHaveBeenCalledWith('token', 'tok');
  });

  it('exception (réseau) → « serveur », jamais un faux succès', async () => {
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: {} } }) },
      from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: vi.fn().mockRejectedValue(new Error('offline')) })) })),
    };
    vi.mocked(getSupabase).mockReturnValue(client as never);
    expect(await revokeEspace('tok')).toEqual({ error: 'serveur' });
  });
});
