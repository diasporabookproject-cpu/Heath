import { describe, expect, it } from 'vitest';
import { splitProchain, nowHHMM, type AgendaItem } from './prochain';

const item = (time: string, kind: AgendaItem['kind'] = 'nounou'): AgendaItem => ({
  time,
  label: time,
  picto: '•',
  kind,
});

describe('splitProchain', () => {
  it('agenda vide → ni prochain ni journée terminée', () => {
    const r = splitProchain([], '12:00');
    expect(r.prochain).toBeUndefined();
    expect(r.timeline).toEqual([]);
    expect(r.done).toBe(false);
  });

  it('milieu de journée → 1er à venir en prochain, le reste en timeline (passé marqué)', () => {
    const items = [item('08:00'), item('12:30', 'cuisine'), item('20:00')];
    const r = splitProchain(items, '10:00');
    expect(r.done).toBe(false);
    expect(r.prochain?.time).toBe('12:30');
    // 08:00 passé, 20:00 à venir ; le prochain (12:30) est exclu de la timeline
    expect(r.timeline.map((i) => i.time)).toEqual(['08:00', '20:00']);
    expect(r.timeline.find((i) => i.time === '08:00')?.past).toBe(true);
    expect(r.timeline.find((i) => i.time === '20:00')?.past).toBe(false);
  });

  it("pile à l'heure d'un élément → cet élément est le prochain", () => {
    const r = splitProchain([item('08:00'), item('12:30')], '12:30');
    expect(r.prochain?.time).toBe('12:30');
    expect(r.done).toBe(false);
  });

  it('C1 — tout est passé → journée terminée, aucun prochain, tout en timeline passée', () => {
    const items = [item('08:00'), item('12:30'), item('20:00')];
    const r = splitProchain(items, '22:00');
    expect(r.prochain).toBeUndefined();
    expect(r.done).toBe(true);
    expect(r.timeline.map((i) => i.time)).toEqual(['08:00', '12:30', '20:00']);
    expect(r.timeline.every((i) => i.past)).toBe(true);
  });
});

describe('nowHHMM', () => {
  it('formate HH:MM sur 2 chiffres', () => {
    expect(nowHHMM(new Date(2026, 6, 4, 9, 5))).toBe('09:05');
    expect(nowHHMM(new Date(2026, 6, 4, 20, 30))).toBe('20:30');
  });
});
