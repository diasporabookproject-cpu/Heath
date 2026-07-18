import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── PORTE « la nutrition est SORTIE » (lot simplification, critère de fini) ───
// Remplace les assertions ON/OFF du flag T2 : la CI échoue si un token nutrition
// (kcal / macro(s) / calcium / prot / gluc) réapparaît dans le CODE EXÉCUTÉ.
// Sans exemption (une exemption est une fissure — du kcal futur pourrait s'y
// cacher). Les commentaires sont retirés avant le scan (ils racontent l'histoire
// de la purge) ; les fichiers de test sont hors périmètre (ils décrivent la porte).

const SRC = join(__dirname, '..');
const TOKEN = /\b(kcal|macros?|calcium|prot|gluc)\b/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

/** Retire commentaires de bloc puis de ligne (le token a le droit de vivre en commentaire). */
function stripComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('porte nutrition — aucun token macro/kcal/calcium dans le code exécuté', () => {
  it('src/**/*.ts(x) hors tests : zéro token nutrition (commentaires exclus)', () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      stripComments(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((l, i) => {
          if (TOKEN.test(l)) offenders.push(`${f.slice(SRC.length + 1)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
