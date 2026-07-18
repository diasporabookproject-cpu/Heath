import { describe, expect, it } from 'vitest';
import { isNotFound } from './storage-err';

describe('sync/storage-err — cache négatif 404-only (mini-lot destinataires F5)', () => {
  it('« objet absent » reconnu sous ses trois formes storage-js', () => {
    expect(isNotFound({ status: 404, message: 'x' })).toBe(true);
    expect(isNotFound({ statusCode: '404', message: 'x' })).toBe(true);
    expect(isNotFound({ message: 'Object not found' })).toBe(true);
    expect(isNotFound({ message: 'The resource was not found' })).toBe(true);
  });

  it('un raté RÉSEAU ne doit JAMAIS être retenu (le bug corrigé)', () => {
    expect(isNotFound({ message: 'TypeError: Failed to fetch' })).toBe(false);
    expect(isNotFound({ status: 0, message: 'network error' })).toBe(false);
    expect(isNotFound({ status: 500, message: 'internal error' })).toBe(false);
    expect(isNotFound({ status: 400, message: 'invalid request' })).toBe(false);
  });

  it('entrées dégénérées : null / undefined / non-objet → jamais retenu', () => {
    expect(isNotFound(null)).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
    expect(isNotFound('not found')).toBe(false);
    expect(isNotFound({})).toBe(false);
  });
});
