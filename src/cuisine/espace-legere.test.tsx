import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EspaceCuisine from './EspaceCuisine';
import type { Espace } from '../lib/espace';

// T4 (SPEC 5 / Q2) — TEST BLOQUANT « recette LÉGÈRE », moitié RENDU : le
// yaourt (nom seul, i: '') doit APPARAÎTRE sur la page reçue — pas de perte
// silencieuse, pas de crash. (La non-traduction darija est PARQUÉE §7.4 :
// le nom s'affiche en français côté darija — comportement attendu, tracé.)

const espace = (langue: 'fr' | 'ar'): Espace => ({
  v: 1,
  langue,
  nom: 'Fatima',
  role: 'Cuisine',
  persons: 4,
  menu: {
    v: 2,
    days: [{ k: 'mar', nom: 'Mardi', gouter: { plat: { n: 'Yaourt', i: '' } } }],
  },
});

describe('page reçue — recette légère (nom seul)', () => {
  it('le yaourt apparaît côté cuisinière (fr), ingrédients vides sans crash', () => {
    const html = renderToStaticMarkup(<EspaceCuisine espace={espace('fr')} />);
    expect(html).toContain('Yaourt');
    expect(html).toContain('Goûter');
  });

  it('en darija : le créneau goûter est là, le nom reste en français (parqué §7.4 — pas de perte)', () => {
    const html = renderToStaticMarkup(<EspaceCuisine espace={espace('ar')} />);
    expect(html).toContain('اللمجة');
    expect(html).toContain('Yaourt'); // visible, jamais disparu en silence
  });
});
