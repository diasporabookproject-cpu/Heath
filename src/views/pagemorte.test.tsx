import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PageMorte from './PageMorte';

// T5 — la page morte est la DERNIÈRE chose que le personnel voit : son contrat se
// verrouille ici (deux langues, celles que le produit publie ; aucune action ;
// « hors-ligne » distinct du « mort »).

describe('PageMorte (T5) — option A', () => {
  it('page morte : les DEUX langues publiées par le produit, et rien d’autre', () => {
    const html = renderToStaticMarkup(<PageMorte cause="morte" />);
    expect(html).toContain('Cette page n’est plus disponible');
    expect(html).toContain('هاد الصفحة ما بقاتش خدامة');
    // Ni anglais ni arabe standard : le produit ne publie que fr + darija (fil v:1).
    expect(html.match(/class="dl/g)).toHaveLength(2);
    // Sans action, volontairement — depuis ce lien il n'y a rien à faire.
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
  });

  it('hors-ligne reste DISTINCT du mort (le lien est vivant, revenir suffit)', () => {
    const html = renderToStaticMarkup(<PageMorte cause="horsligne" />);
    expect(html).toContain('Pas de connexion');
    expect(html).toContain('Réessayez dès que le réseau revient');
    expect(html).not.toContain('Cette page n’est plus disponible');
  });

  it('la darija est posée en RTL avec sa langue (lecture correcte du script)', () => {
    const html = renderToStaticMarkup(<PageMorte cause="morte" />);
    expect(html).toContain('class="dl rtl" lang="ar" dir="rtl"');
  });
});
