// A6 — Entretenir la bibliothèque (frictions PO : générer via différents modes · updater ·
// modifier). ① chaque mode d'ajout · ② modifier une recette · ③ organiser.
import { open, Film, bypassFtue, installCollection } from './lib.mjs';

const dir = 'ux-captures/A-flux/A6-bibliotheque-recettes';
const { browser, page } = await open();
const f = new Film(dir);

await bypassFtue(page);
await installCollection(page); // ouvre Cuisine + onglet Recettes, 30 recettes

// ── ① Les 4 modes d'ajout (le « choose » puis chaque mode) ────────────────────
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-fab').click(); f.tap();
await page.getByText('Nouvelle recette', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'add-choix', { screen: 'Recettes/ajout', note: '4 modes : manuel · IA · coller · JSON' });

// Saisie manuelle : compter les champs
await page.getByText('Saisie manuelle', { exact: false }).click(); f.tap();
await page.waitForTimeout(400);
await f.shot(page, 'add-manuel', { screen: 'Recettes/manuel', note: 'CHAMPS exigés : nom, rôle, kcal, prot, gluc, lip, calcium, ingrédients…' });
// retour
await page.locator('.cz-sheet.show .cz-x, .cz-back').first().click().catch(() => {});
await page.waitForTimeout(300);

// IA (coup de main) : capturer l'état (peut être grisé si non connecté — le noter)
const s2 = await open();
const page2 = s2.page;
await bypassFtue(page2); await installCollection(page2);
await page2.getByRole('tab', { name: 'Recettes' }).click();
await page2.locator('.cz-fab').click();
await page2.getByText('Nouvelle recette', { exact: false }).waitFor({ timeout: 5000 });
const ai = page2.getByText('Coup de main', { exact: false }).first();
await f.shot(page2, 'add-ia-etat', { screen: 'Recettes/IA', note: 'mode IA : dispo si connecté + quota (état grisé hors-ligne visible)' });
if (await ai.count()) { await ai.click(); f.tap(); await page2.waitForTimeout(400);
  await f.shot(page2, 'add-ia-ouvert', { screen: 'Recettes/IA', note: 'ce que l\'IA demande (si ouvrable)' }); }
await s2.browser.close();

// Import JSON
const imp = page.getByText('Importer (JSON)', { exact: false }).first();
if (await imp.count()) { await imp.click(); f.tap(); await page.waitForTimeout(400);
  await f.shot(page, 'add-json', { screen: 'Recettes/JSON', note: 'zone de collage JSON' }); }

// ── ② Modifier une recette existante ──────────────────────────────────────────
const s3 = await open();
const page3 = s3.page;
await bypassFtue(page3); await installCollection(page3);
await page3.getByRole('tab', { name: 'Recettes' }).click();
await page3.locator('.cz-librow').first().click(); f.tap();
await page3.waitForTimeout(500);
await f.shot(page3, 'fiche-recette', { screen: 'Recettes/fiche', note: 'fiche : macros, ingrédients, étapes, vocal' });
try {
  const edit = page3.locator('.cz-sheet.show').getByText(/Modifier/i).first();
  await edit.click({ timeout: 4000 }); f.tap(); await page3.waitForTimeout(400);
  await f.shot(page3, 'fiche-edition', { screen: 'Recettes/édition', note: 'champs éditables (mêmes que saisie manuelle)' });
} catch { /* bouton hors écran / état différent — non bloquant */ }
await s3.browser.close();

// ── ③ Organiser : favoris + filtres + collections ─────────────────────────────
await page.getByText('Importer (JSON)', { exact: false }).first().waitFor({ timeout: 2000 }).catch(() => {});
const s4 = await open();
const page4 = s4.page;
await bypassFtue(page4); await installCollection(page4);
await page4.getByRole('tab', { name: 'Recettes' }).click();
await f.shot(page4, 'organiser-biblio', { screen: 'Recettes/bibliothèque', note: '30 recettes, chips de rôle/filtre, favoris, entrée Collections' });
await s4.browser.close();

f.writeMetrics('A6 — Entretenir la bibliothèque', `## Les 4 modes d'ajout et leur coût
**Manuel** : ~8 champs nutritionnels + nom + rôle + ingrédients (le plus lourd). **IA** : conditionné
connexion + quota (grisé sinon) — décrit ce qu'il demande. **Coller (texte)** / **JSON** : import.
**Modifier** : fiche → éditer → mêmes champs qu'en manuel. **Organiser** : favoris, filtres par rôle,
collections. Candidat doctrine : le mode manuel demande TOUS les champs nutritionnels d'emblée —
beaucoup pourraient être **calculés par défaut** (déjà le cas via l'IA/auto-macros) et repliés.`);

console.log(`A6 : ${f.n} états →`, dir);
await browser.close();
