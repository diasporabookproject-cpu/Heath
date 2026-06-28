import { describe, expect, it } from 'vitest';
import { projectDay, activePeriode, weekdayOf, periodesOverlap } from './projection';
import { emptyNounouDoc } from './defaults';
import type { Moment, NounouDoc } from '../types';

function m(partial: Partial<Moment>): Moment {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    label: partial.label ?? 'X',
    heure: partial.heure ?? '08:00',
    type: partial.type ?? 'autre',
    jours: partial.jours ?? [0, 1, 2, 3, 4, 5, 6],
    enfants: partial.enfants ?? [],
    qui: partial.qui,
    lieu: partial.lieu,
    note: partial.note,
  };
}

describe('weekdayOf (0 = lundi)', () => {
  it('mappe correctement les jours', () => {
    expect(weekdayOf('2026-06-29')).toBe(0); // lundi
    expect(weekdayOf('2026-06-28')).toBe(6); // dimanche
    expect(weekdayOf('2026-06-26')).toBe(4); // vendredi
  });
});

describe('projectDay — rythme habituel', () => {
  it('ne garde que les moments du bon jour de semaine, triés par heure', () => {
    const doc: NounouDoc = {
      ...emptyNounouDoc(),
      rythme: [
        m({ label: 'Coucher', heure: '20:30', jours: [0, 1, 2, 3, 4, 5, 6] }),
        m({ label: 'École', heure: '08:00', jours: [0, 1, 2, 3, 4] }),
        m({ label: 'Week-end only', heure: '10:00', jours: [5, 6] }),
      ],
    };
    const lundi = projectDay(doc, '2026-06-29'); // lundi
    expect(lundi.map((e) => e.label)).toEqual(['École', 'Coucher']);
    expect(lundi.every((e) => e.source === 'rythme')).toBe(true);

    const samedi = projectDay(doc, '2026-06-27'); // samedi
    expect(samedi.map((e) => e.label)).toEqual(['Week-end only', 'Coucher']);
  });

  it('jour vide → liste vide', () => {
    const doc = { ...emptyNounouDoc(), rythme: [m({ jours: [0] })] };
    expect(projectDay(doc, '2026-06-27')).toEqual([]); // samedi, pas de moment
  });
});

describe('projectDay — précédence période > rythme', () => {
  const doc: NounouDoc = {
    ...emptyNounouDoc(),
    rythme: [m({ label: 'École', heure: '08:00', jours: [0, 1, 2, 3, 4] })],
    periodes: [
      {
        id: 'p1',
        nom: 'Vacances',
        emoji: '🏖️',
        debut: '2026-07-01',
        fin: '2026-07-15',
        rythme: [m({ label: 'Grasse mat', heure: '10:00', jours: [0, 1, 2, 3, 4, 5, 6] })],
      },
    ],
  };

  it('hors période → rythme habituel', () => {
    expect(projectDay(doc, '2026-06-29').map((e) => e.label)).toEqual(['École']);
  });

  it('dans la période → rythme de la période, source = periode', () => {
    const res = projectDay(doc, '2026-07-02'); // jeudi en vacances
    expect(res.map((e) => e.label)).toEqual(['Grasse mat']);
    expect(res[0].source).toBe('periode');
    expect(activePeriode(doc, '2026-07-02')?.nom).toBe('Vacances');
  });
});

describe('projectDay — ponctuels par-dessus', () => {
  it('ajoute le ponctuel du jour, marqué et trié', () => {
    const doc: NounouDoc = {
      ...emptyNounouDoc(),
      rythme: [m({ label: 'École', heure: '08:00', jours: [0, 1, 2, 3, 4] })],
      ponctuels: [
        { id: 'x', date: '2026-06-29', label: 'Dentiste', heure: '09:30', type: 'sante', enfants: [] },
      ],
    };
    const res = projectDay(doc, '2026-06-29');
    expect(res.map((e) => e.label)).toEqual(['École', 'Dentiste']);
    expect(res[1].source).toBe('ponctuel');
    // un autre jour : le ponctuel n'apparaît pas
    expect(projectDay(doc, '2026-06-30').some((e) => e.label === 'Dentiste')).toBe(false);
  });
});

describe('periodesOverlap', () => {
  it('détecte le chevauchement (création à interdire)', () => {
    expect(periodesOverlap({ debut: '2026-07-01', fin: '2026-07-10' }, { debut: '2026-07-05', fin: '2026-07-20' })).toBe(true);
    expect(periodesOverlap({ debut: '2026-07-01', fin: '2026-07-10' }, { debut: '2026-07-11', fin: '2026-07-20' })).toBe(false);
  });
});
