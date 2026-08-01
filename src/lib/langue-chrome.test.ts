import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NOUNOU_LANGS, type NounouLangue } from '../types';

/**
 * 🔴 LA RÈGLE : l'interface de l'employeur est TOUJOURS en français ; les noms de
 * langue s'écrivent en lettres latines (« Darija », pas « الدارجة »).
 *
 * Ce n'est pas de la cosmétique. Ces libellés servent à **choisir** la langue de son
 * destinataire : quelqu'un qui ne lit pas l'arabe doit pouvoir désigner « darija »
 * pour sa cuisinière. Un endonyme rend la liste illisible à celui qui doit s'en servir.
 *
 * CE QUI RESTE EN ARABE, volontairement, et n'est pas visé ici :
 *  · le CONTENU destiné au personnel — la page reçue (`EspaceCuisine`, `labels.ts`,
 *    `cuisineLabels.ts`), la page morte, le message envoyé (`digest.ts`), la puce de
 *    la bulle : c'est ce que la personne LIT, dans sa langue ;
 *  · les libellés des champs de SAISIE arabe (fiche recette, Sécurité) — hors portée
 *    par décision PO (ils accompagnent une frappe en arabe) ;
 *  · le logotype « Manzil · منزل » de la FTUE — une marque, pas un libellé ;
 *  · `src/ui/MzDemo.tsx` — vitrine de design, hors navigation de prod.
 */

const ARABE = /[؀-ۿ]/;

/** Le second catalogue vit dans la FTUE et n'est pas exporté : on le lit à la source. */
function catalogueFtue(): { code: NounouLangue; label: string }[] {
  const src = readFileSync('src/ftue/Ftue.tsx', 'utf8');
  const bloc = src.match(/const LANGS[^=]*=\s*\[([\s\S]*?)\];/);
  if (!bloc) throw new Error('Ftue.tsx : catalogue LANGS introuvable');
  return [...bloc[1].matchAll(/\{\s*code:\s*'(\w+)',\s*label:\s*'([^']*)'/g)].map((m) => ({
    code: m[1] as NounouLangue,
    label: m[2],
  }));
}

describe('les noms de langue du chrome employeur s’écrivent en français', () => {
  it('le catalogue SOURCE (`NOUNOU_LANGS`) n’a aucun nom en écriture arabe', () => {
    for (const l of NOUNOU_LANGS) {
      expect(ARABE.test(l.nom), `${l.code} : « ${l.nom} » doit s’écrire en lettres latines`).toBe(false);
      expect(ARABE.test(l.sub), `${l.code} : le sous-titre « ${l.sub} » aussi`).toBe(false);
    }
  });

  it('le catalogue de la FTUE non plus', () => {
    const ftue = catalogueFtue();
    expect(ftue.length).toBeGreaterThan(0);
    for (const l of ftue) {
      expect(ARABE.test(l.label), `FTUE ${l.code} : « ${l.label} » doit s’écrire en lettres latines`).toBe(false);
    }
  });

  it('les DEUX catalogues s’accordent — la duplication peut vivre, pas dériver', () => {
    // D5 dit « une liste fermée » ; il en existe deux (déduplication au backlog).
    // Tant qu'elles coexistent, elles doivent au moins dire la même chose : deux
    // noms différents pour la même langue selon l'écran serait pire que l'arabe.
    const source = new Map(NOUNOU_LANGS.map((l) => [l.code, l.nom]));
    for (const l of catalogueFtue()) {
      expect(source.get(l.code), `la FTUE connaît « ${l.code} », pas le catalogue source`).toBeDefined();
      expect(l.label, `« ${l.code} » : la FTUE dit « ${l.label} », la source « ${source.get(l.code)} »`).toBe(
        source.get(l.code),
      );
    }
  });

  it('franciser le NOM n’a pas francisé le RENDU : darija et arabe restent RTL', () => {
    // La page reçue, elle, s'écrit bien de droite à gauche. `rtl` est une vérité
    // technique — la confondre avec le libellé casserait la page de la cuisinière.
    expect(NOUNOU_LANGS.find((l) => l.code === 'dr')?.rtl).toBe(true);
    expect(NOUNOU_LANGS.find((l) => l.code === 'ar')?.rtl).toBe(true);
    expect(NOUNOU_LANGS.find((l) => l.code === 'fr')?.rtl).toBe(false);
  });
});
