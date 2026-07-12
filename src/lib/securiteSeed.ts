import seedData from '../data/securite-seed.json';
import { loadSecurite, saveSecurite } from './db';
import type { SecuriteFiche } from '../types';

// F4 (Flow FTUE) : l'import du pack sécurité, EXTRAIT de SecuriteView pour être
// appelable par la FTUE (domaine « La sécurité ») ET par le bouton de la vue —
// même fonction, même comportement. Fiches importées en statut « Test » : le
// parent RELIT puis valide (principe « réceptacle des consignes du parent »).
// Idempotent : anti-doublon par TITRE.

export async function importSecuriteSeed(): Promise<number> {
  const existing = new Set((await loadSecurite()).map((f) => f.titre));
  let n = 0;
  for (const s of seedData as Omit<SecuriteFiche, 'id' | 'statut' | 'createdAt'>[]) {
    if (existing.has(s.titre)) continue;
    await saveSecurite({
      ...s,
      id: crypto.randomUUID(),
      statut: 'Test',
      createdAt: Date.now() + n,
    });
    n++;
  }
  return n;
}
