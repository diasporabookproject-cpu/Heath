import { describe, expect, it } from 'vitest';
import { rappelLabel, reminderDue } from './rappel';

// Horloge simulée. Rappel = samedi (day 5) à 9:00.
const sam9 = { day: 5, time: '9:00' };

describe('rappel — échéance', () => {
  it('rappelLabel', () => {
    expect(rappelLabel(sam9)).toBe('Chaque samedi à 9:00');
    expect(rappelLabel({ day: 0, time: '20:00' })).toBe('Chaque lundi à 20:00');
  });

  it('sans dernier passage → dû (une échéance passée existe)', () => {
    // mercredi 8 juillet 2026, 10:00 → dernier samedi = 4 juillet 9:00 (passé)
    expect(reminderDue(sam9, undefined, new Date(2026, 6, 8, 10, 0))).toBe(true);
  });

  it('échéance franchie depuis le dernier passage → dû', () => {
    // dernier passage vendredi 3 juillet ; maintenant samedi 4 juillet 10:00 (après 9:00)
    const last = new Date(2026, 6, 3, 12, 0).toISOString();
    expect(reminderDue(sam9, last, new Date(2026, 6, 4, 10, 0))).toBe(true);
  });

  it('échéance PAS encore franchie → non dû', () => {
    // dernier passage samedi 4 juillet 12:00 ; maintenant dimanche 5 juillet
    // (prochaine échéance = samedi 11 → pas encore)
    const last = new Date(2026, 6, 4, 12, 0).toISOString();
    expect(reminderDue(sam9, last, new Date(2026, 6, 5, 10, 0))).toBe(false);
  });

  it('avant l’heure le jour J → non dû (occurrence = samedi précédent, déjà vu)', () => {
    // samedi 4 juillet 8:00 (avant 9:00) ; dernier passage = samedi précédent vu
    const last = new Date(2026, 5, 27, 12, 0).toISOString(); // sam 27 juin
    // occurrence la plus récente à 8:00 = sam 27 juin 9:00 → pas > last (même jour, après midi)
    expect(reminderDue(sam9, last, new Date(2026, 6, 4, 8, 0))).toBe(false);
  });
});
