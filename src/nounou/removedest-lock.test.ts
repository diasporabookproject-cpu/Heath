import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Verrou A7-C4 (audit §7.8) — « Retirer » Nounou a un appelant UI ──────────
// `removeDest` existait dans le store mais AUCUN écran ne l'appelait → destinataire
// Nounou immortel. Ce test STATIQUE verrouille la régression : si le câblage UI
// disparaît (refactor, suppression du bouton), il ÉCHOUE. Miroir du verrou langue.

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe('verrou A7-C4 — le geste « Retirer » Nounou reste câblé', () => {
  it('au moins un composant (.tsx) appelle removeDest', () => {
    const callers = walk(SRC).filter((f) => /\bremoveDest\s*\(/.test(readFileSync(f, 'utf8')));
    expect(callers.length).toBeGreaterThan(0);
  });
});
