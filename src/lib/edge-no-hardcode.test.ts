import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// PORTE « aucun protocole personnel dans les prompts » (prompt v2 T2b) — le
// miroir SERVEUR de la porte nutrition client. La CI échoue si le hardcode
// « 100% sans gluten / calcium enjeu n°1 » (ou un vestige nutrition) réapparaît
// dans le CODE des edge functions. Prouve « disparu, pas déplacé ».

const FN_DIR = join(__dirname, '..', '..', 'supabase', 'functions');
const TOKEN = /\b(gluten|calcium|prot(?:é|e)ines?|macros?|kcal)\b/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.ts$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

function stripComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('porte serveur — aucun protocole personnel dans les edge functions', () => {
  it('supabase/functions/**/*.ts (hors tests) : zéro token nutrition/gluten (commentaires exclus)', () => {
    const offenders: string[] = [];
    for (const f of walk(FN_DIR)) {
      stripComments(readFileSync(f, 'utf8'))
        .split('\n')
        .forEach((l, i) => {
          if (TOKEN.test(l)) offenders.push(`${f.slice(FN_DIR.length + 1)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
