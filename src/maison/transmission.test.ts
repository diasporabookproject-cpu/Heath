import { describe, expect, it } from 'vitest';
import { envoiState, pillKind } from './transmission';
import type { PublishRecord } from '../lib/db';

const rec = (sig: string): PublishRecord => ({ token: 't', sig, at: '2026-07-04T00:00:00Z' });

describe('envoiState', () => {
  it('jamais publié → never', () => {
    expect(envoiState('abc', undefined)).toBe('never');
  });
  it('signature identique → uptodate', () => {
    expect(envoiState('abc', rec('abc'))).toBe('uptodate');
  });
  it('signature différente → modified', () => {
    expect(envoiState('abc', rec('xyz'))).toBe('modified');
  });
});

describe('pillKind (priorité Envoyer > Briefer > Planifier > chevron)', () => {
  const base = { hasUpcomingPonctuel: false, nextWeekEmpty: false };

  it('non à jour → Envoyer (prioritaire, même si autres signaux)', () => {
    expect(pillKind({ ...base, state: 'never', kind: 'nounou', hasUpcomingPonctuel: true })).toBe('envoyer');
    expect(pillKind({ ...base, state: 'modified', kind: 'cuisine', nextWeekEmpty: true })).toBe('envoyer');
  });

  it('nounou à jour + ponctuel à venir → Briefer', () => {
    expect(pillKind({ ...base, state: 'uptodate', kind: 'nounou', hasUpcomingPonctuel: true })).toBe('briefer');
  });

  it('cuisine à jour + semaine suivante vide → Planifier', () => {
    expect(pillKind({ ...base, state: 'uptodate', kind: 'cuisine', nextWeekEmpty: true })).toBe('planifier');
  });

  it('à jour sans signal → chevron (null) : jamais de fausse alerte', () => {
    expect(pillKind({ ...base, state: 'uptodate', kind: 'nounou' })).toBeNull();
    expect(pillKind({ ...base, state: 'uptodate', kind: 'cuisine' })).toBeNull();
  });

  it('signal du mauvais rôle ignoré (cuisine + ponctuel, nounou + semaine vide)', () => {
    expect(pillKind({ ...base, state: 'uptodate', kind: 'cuisine', hasUpcomingPonctuel: true })).toBeNull();
    expect(pillKind({ ...base, state: 'uptodate', kind: 'nounou', nextWeekEmpty: true })).toBeNull();
  });
});
