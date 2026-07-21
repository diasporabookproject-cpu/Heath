import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EspaceCuisine from './EspaceCuisine';
import type { Espace } from '../lib/espace';

// T3 (lot partage) — TESTS BLOQUANTS de la page reçue :
// ① LIEN PERPÉTUEL : une page publiée AVANT le suivi (ni `cl` ni `tasks`) rend
//   SANS case ni section tâches — le patron `gouter?` (T3 lot UI), prouvé ici
//   pour le nouveau champ. ② Avec `cl:1` : cases sur les repas du jour + tâches.
// ③ NON-TRADUCTION encodée (décision PO ③, contrat espace-legere) : la tâche
//   reste en FRANÇAIS côté darija — visible telle quelle, jamais masquée.

const base = (extra: Partial<Espace> = {}, langue: 'fr' | 'ar' = 'fr'): Espace => ({
  v: 1,
  langue,
  nom: 'Fatima',
  role: 'Cuisine',
  persons: 4,
  menu: {
    v: 2,
    days: [
      {
        k: 'mar',
        nom: 'Mardi',
        dej: { plat: { n: 'Tajine de poulet', i: 'poulet 200 g' } },
        gouter: { plat: { n: 'Yaourt', i: '' } },
      },
    ],
  },
  ...extra,
});

describe('lien perpétuel — page publiée AVANT le suivi (ni cl ni tasks)', () => {
  it('aucune case, aucune section tâches : rendu d’avant, à l’identique', () => {
    const html = renderToStaticMarkup(<EspaceCuisine espace={base()} />);
    expect(html).toContain('Tajine de poulet'); // la page vit
    expect(html).not.toContain('ck-check'); // pas de case
    expect(html).not.toContain('ck-taskrow'); // pas de tâches
    expect(html).not.toContain('Tâches en plus');
  });
});

describe('checklist active (cl: 1)', () => {
  it('cases rendues sur les repas du jour + tâches libres listées', () => {
    const html = renderToStaticMarkup(
      <EspaceCuisine espace={base({ cl: 1, tasks: [{ id: 'a1', t: 'Nettoyer le salon' }] })} />,
    );
    expect(html).toContain('ck-check'); // cases présentes (aperçu : inertes)
    expect(html).toContain('Tâches en plus');
    expect(html).toContain('Nettoyer le salon');
  });

  it('sans token (aperçu employeur) : les cases sont NON interactives', () => {
    const html = renderToStaticMarkup(<EspaceCuisine espace={base({ cl: 1 })} />);
    expect(html).toContain('ck-check');
    expect(html).toContain(' ro'); // classe lecture seule
  });

  it('cl actif mais tasks vide/absent : les repas cochables, pas de section vide', () => {
    const html = renderToStaticMarkup(<EspaceCuisine espace={base({ cl: 1 })} />);
    expect(html).toContain('ck-check');
    expect(html).not.toContain('Tâches en plus'); // pas d'en-tête orphelin
  });
});

describe('non-traduction des tâches (décision PO ③ — contrat espace-legere)', () => {
  it('côté darija : le libellé de section est traduit, la TÂCHE reste en français', () => {
    const html = renderToStaticMarkup(
      <EspaceCuisine espace={base({ cl: 1, tasks: [{ id: 'a1', t: 'Arroser les plantes' }] }, 'ar')} />,
    );
    expect(html).toContain('مهام زايدة'); // libellé UI traduit
    expect(html).toContain('Arroser les plantes'); // contenu fr, visible, jamais perdu
  });
});
