import { describe, it, expect } from 'vitest';
import { messageInvitation } from './ComptePage';

// T4 — le message d'invitation. Le code seul est mort-né : il faut dire CE QUE C'EST,
// LE CODE, et OÙ INSTALLER. Ce test épingle la réserve : `manzil.ma` n'est pas acheté,
// donc le lien envoyé est l'URL web RÉELLE de l'app — jamais un domaine qui n'existe pas.

describe('messageInvitation (T4)', () => {
  const m = messageInvitation('DEP79V2XZF', 'https://exemple.github.io/Heath/');

  it('porte les trois choses : ce que c’est, le code, où installer', () => {
    expect(m).toContain('Manzil');
    expect(m).toContain('DEP79V2XZF');
    expect(m).toContain('https://exemple.github.io/Heath/');
    expect(m).toMatch(/Installe l’app/);
  });

  it('n’invente AUCUN domaine — `manzil.ma` n’existe pas encore', () => {
    expect(m).not.toMatch(/manzil\.ma/i);
  });
});
