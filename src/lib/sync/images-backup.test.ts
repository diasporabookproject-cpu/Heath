import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backupImage, retryImageBackup } from './images';
import { getSupabase } from '../supabase';
import { currentFoyerId } from '../auth';
import { loadImage, markImageBackedUp } from '../db';

// F4 (mini-lot destinataires) — la transition d'état `backedUp` :
// flag posé à la CONFIRMATION d'upload seulement ; la retentative au montage
// n'agit QUE si le flag est faux (jamais de retry aveugle).

vi.mock('../supabase', () => ({ getSupabase: vi.fn() }));
vi.mock('../auth', () => ({ currentFoyerId: vi.fn() }));
vi.mock('../db', () => ({
  loadImage: vi.fn(),
  saveImage: vi.fn(),
  markImageBackedUp: vi.fn(),
}));

const blob = new Blob(['x'], { type: 'image/jpeg' });

function storageMock(uploadError: unknown = null) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError });
  const client = { storage: { from: vi.fn(() => ({ upload })) } };
  return { client, upload };
}

beforeEach(() => {
  vi.mocked(getSupabase).mockReset();
  vi.mocked(currentFoyerId).mockReset().mockResolvedValue('foyer-1');
  vi.mocked(loadImage).mockReset();
  vi.mocked(markImageBackedUp).mockReset().mockResolvedValue();
});

describe('sync/images — état backedUp (F4)', () => {
  it('upload confirmé → flag posé', async () => {
    const m = storageMock();
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    await backupImage('r1', blob, 'image/jpeg');
    expect(m.upload).toHaveBeenCalled();
    expect(markImageBackedUp).toHaveBeenCalledWith('r1');
  });

  it('upload en erreur → flag NON posé (on retentera)', async () => {
    const m = storageMock({ message: 'RLS' });
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    await backupImage('r1', blob, 'image/jpeg');
    expect(markImageBackedUp).not.toHaveBeenCalled();
  });

  it('hors-ligne/sans client → rien ne casse, flag NON posé', async () => {
    vi.mocked(getSupabase).mockReturnValue(null as never);
    await backupImage('r1', blob, 'image/jpeg');
    expect(markImageBackedUp).not.toHaveBeenCalled();
  });

  it('retentative : photo déjà confirmée → AUCUN upload (le retry aveugle rejeté PO)', async () => {
    const m = storageMock();
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    vi.mocked(loadImage).mockResolvedValue({ recipeId: 'r1', blob, mime: 'image/jpeg', updatedAt: 1, backedUp: true });
    await retryImageBackup('r1');
    expect(m.upload).not.toHaveBeenCalled();
  });

  it('retentative : sauvegarde non confirmée → upload retenté, flag posé au succès', async () => {
    const m = storageMock();
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    vi.mocked(loadImage).mockResolvedValue({ recipeId: 'r1', blob, mime: 'image/jpeg', updatedAt: 1 });
    await retryImageBackup('r1');
    expect(m.upload).toHaveBeenCalled();
    expect(markImageBackedUp).toHaveBeenCalledWith('r1');
  });

  it('retentative : aucune photo locale → rien', async () => {
    const m = storageMock();
    vi.mocked(getSupabase).mockReturnValue(m.client as never);
    vi.mocked(loadImage).mockResolvedValue(undefined);
    await retryImageBackup('r1');
    expect(m.upload).not.toHaveBeenCalled();
  });
});
