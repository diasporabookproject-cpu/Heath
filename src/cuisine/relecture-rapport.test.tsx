import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RelectureRapport from './RelectureRapport';
import type { Recipe } from '../types';

// T2a (lot simplification) — le bandeau de relecture v2 est TOLÉRANT :
// il lit le rapport du prompt v2 s'il est là, et retombe sur `adapteSelon`
// (l'ancien edge n'envoie PAS adaptations/quantites_incertaines/alerte_regles).

const html = (r: Partial<Recipe>) => renderToStaticMarkup(<RelectureRapport recipe={r as Recipe} />);

describe('RelectureRapport — tolérance bidirectionnelle', () => {
  it('ancien edge (adaptations absent) + demande → fallback « on a demandé d’adapter »', () => {
    const h = html({ adapteSelon: ['halal', 'gluten'] });
    expect(h).toContain('On a demandé d’adapter selon');
    expect(h).toContain('halal · gluten');
  });

  it('edge v2 : adaptations rapportées → « Adapté — … » ligne à ligne', () => {
    const h = html({
      adapteSelon: ['sans arachide'],
      adaptations: [{ regle: 'sans arachide', action: 'cacahuètes → graines de courge' }],
    });
    expect(h).toContain('Adapté');
    expect(h).toContain('cacahuètes → graines de courge');
    expect(h).not.toContain('On a demandé'); // le rapport REMPLACE la demande
  });

  it('edge v2 + règles posées MAIS adaptations vide → « aucune adaptation signalée » (honnête)', () => {
    const h = html({ adapteSelon: ['halal'], quantites_incertaines: ['farine'] });
    expect(h).toContain('Aucune adaptation signalée pour : halal');
  });

  it('alerte_regles (garde G3 serveur) → bandeau d’alerte', () => {
    const h = html({ alerte_regles: ['"arachide" présent malgré la règle'] });
    expect(h).toContain('arachide');
    expect(h).toContain('cz-relwarn');
  });

  it('quantites_incertaines → invite à compléter', () => {
    const h = html({ quantites_incertaines: ['farine', 'huile'] });
    expect(h).toContain('2 quantités');
    expect(h).toContain('farine, huile');
  });

  it('rien à signaler (ni v2 ni demande) → aucun bandeau', () => {
    expect(html({})).toBe('');
  });
});
