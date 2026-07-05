import { describe, expect, it } from 'vitest';
import { AI_MONTHLY_LIMIT, consume, currentMonth, normalizeQuota, remaining } from './quota';

describe('quota IA', () => {
  it('currentMonth formate YYYY-MM', () => {
    expect(currentMonth(new Date(2026, 6, 4))).toBe('2026-07');
    expect(currentMonth(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('normalizeQuota : absent → neuf', () => {
    expect(normalizeQuota(undefined, '2026-07')).toEqual({ month: '2026-07', used: 0 });
  });

  it('normalizeQuota : reset au changement de mois', () => {
    expect(normalizeQuota({ month: '2026-06', used: 4 }, '2026-07')).toEqual({ month: '2026-07', used: 0 });
  });

  it('normalizeQuota : même mois → conservé', () => {
    expect(normalizeQuota({ month: '2026-07', used: 3 }, '2026-07')).toEqual({ month: '2026-07', used: 3 });
  });

  it('remaining : borné à [0, limite]', () => {
    expect(remaining({ month: '2026-07', used: 0 })).toBe(AI_MONTHLY_LIMIT);
    expect(remaining({ month: '2026-07', used: AI_MONTHLY_LIMIT })).toBe(0);
    expect(remaining({ month: '2026-07', used: AI_MONTHLY_LIMIT + 10 })).toBe(0);
  });

  it('consume : incrémente sans dépasser la limite', () => {
    expect(consume({ month: '2026-07', used: 3 })).toEqual({ month: '2026-07', used: 4 });
    expect(consume({ month: '2026-07', used: AI_MONTHLY_LIMIT })).toEqual({
      month: '2026-07',
      used: AI_MONTHLY_LIMIT,
    });
  });
});
