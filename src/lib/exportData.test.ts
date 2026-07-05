import { describe, expect, it } from 'vitest';
import { exportFilename } from './exportData';

describe('exportData', () => {
  it('exportFilename est daté et sans caractère problématique', () => {
    const name = exportFilename(new Date('2026-07-05T14:30:00Z'));
    expect(name).toBe('manzil-sauvegarde-2026-07-05.json');
    expect(name).not.toMatch(/[^a-zA-Z0-9._-]/);
  });
});
