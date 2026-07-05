import { describe, expect, it } from 'vitest';
import { rappelLabel } from './rappel';

describe('rappel', () => {
  it('rappelLabel', () => {
    expect(rappelLabel({ day: 5, time: '9:00' })).toBe('Chaque samedi à 9:00');
    expect(rappelLabel({ day: 0, time: '20:00' })).toBe('Chaque lundi à 20:00');
    expect(rappelLabel({ day: 6, time: '18:00' })).toBe('Chaque dimanche à 18:00');
  });
});
