import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Verrou T2 (mini-lot destinataires) — remappage 'ar' → 'dr' ───────────────
// Côté Cuisine, `'ar'` sur un Destinataire signifiait DARIJA ; le catalogue dit
// `'dr'` = darija et `'ar'` = arabe classique (MSA). Ce test STATIQUE verrouille
// la sortie du vieux vocabulaire : si un futur code écrit `langue: 'ar'` ou teste
// `langue === 'ar'` sur un Destinataire, il ÉCHOUE — le seul `'ar'` légitime est
// celui du FIL v:1 (via `wireLangue`) et celui du catalogue NounouLangue (MSA).
// (La page reçue lit `espace.langue` sous le nom `lang` — non concernée.)

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => p.slice(SRC.length + 1).replace(/\\/g, '/');

describe('verrou T2 — le vocabulaire Destinataire ne régresse pas vers \'ar\'', () => {
  it("aucun `langue: 'ar'` ni `langue === 'ar'` dans src (hors commentaires)", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const code = readFileSync(f, 'utf8')
        .split('\n')
        .map((l) => l.replace(/\/\/.*$/, '')) // les commentaires racontent l'histoire, ils ont le droit
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      if (/langue\s*(?::|===)\s*'ar'/.test(code)) offenders.push(rel(f));
    }
    expect(offenders).toEqual([]);
  });
});
