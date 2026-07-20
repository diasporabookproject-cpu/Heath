import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EspaceCuisine from './EspaceCuisine';
import type { Espace } from '../lib/espace';
import type { SharedDay } from '../lib/share';

// T3 (lot UI) — TEST BLOQUANT « lien perpétuel » : les pages publiées AVANT le
// 4ᵉ moment n'ont pas de clé `gouter`. Le lecteur doit rendre ces liens À
// L'IDENTIQUE : ni plantage, ni créneau fantôme. (L'ajout est additif ; le
// rendu filtre sur la présence de données — EspaceCuisine `MK_LIST.filter`.)

const day = (extra: Partial<SharedDay> = {}): SharedDay => ({
  k: 'lun',
  nom: 'Lundi',
  petitdej: { plat: { n: 'Msemmen', i: 'farine 200 g' } },
  dej: { plat: { n: 'Couscous', i: 'semoule 300 g' } },
  ...extra,
});

const espace = (days: SharedDay[], langue: 'fr' | 'ar' = 'fr'): Espace => ({
  v: 1,
  langue,
  nom: 'Fatima',
  role: 'Cuisine',
  persons: 4,
  menu: { v: 2, days },
});

const render = (e: Espace) => renderToStaticMarkup(<EspaceCuisine espace={e} />);

describe('EspaceCuisine — lien perpétuel (payload pré-goûter)', () => {
  it('une page publiée SANS clé gouter rend sans créneau fantôme ni plantage', () => {
    const html = render(espace([day()]));
    expect(html).toContain('Msemmen');
    expect(html).toContain('Couscous');
    // Aucun créneau goûter fantôme : le libellé n'apparaît nulle part.
    expect(html).not.toContain('Goûter');
    expect(html).not.toContain('اللمجة');
  });

  it('idem en darija (le fil v:1 : langue « ar »)', () => {
    const html = render(espace([day()], 'ar'));
    expect(html).toContain('الفطور'); // petit-déjeuner présent
    expect(html).not.toContain('اللمجة'); // pas de goûter fantôme
  });

  it('une page publiée AVEC gouter le rend, entre le déjeuner et le dîner', () => {
    const html = render(espace([day({ gouter: { plat: { n: 'Cookies aux amandes', i: 'amandes 100 g' } } })]));
    expect(html).toContain('Goûter');
    expect(html).toContain('Cookies aux amandes');
    // Ordre des moments : le goûter APRÈS le déjeuner (MK_LIST).
    expect(html.indexOf('Goûter')).toBeGreaterThan(html.indexOf('Couscous'));
  });

  it('libellé darija du goûter : « اللمجة » (ruling PO)', () => {
    const html = render(espace([day({ gouter: { plat: { n: 'Cookies', i: '' } } })], 'ar'));
    expect(html).toContain('اللمجة');
  });
});
