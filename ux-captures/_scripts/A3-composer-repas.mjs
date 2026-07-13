// A3 — Composer un repas (friction PO : « critères trop complexes — calories, entrée,
// accompagnement »). Chaque champ / critère / étape du composeur.
import { open, Film, bypassFtue, installCollection } from './lib.mjs';

const dir = 'ux-captures/A-flux/A3-composer-repas';
const { browser, page } = await open();
const f = new Film(dir);

await bypassFtue(page);
await installCollection(page);
await page.getByRole('tab', { name: 'Semaine' }).click();

// Objectif calorique (pastille d'en-tête) — une décision « réglage »
await page.locator('.cz-pill').click(); f.tap();
await page.getByText('Objectif par personne', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'objectif', { screen: 'Cuisine/objectif', note: 'kcal/personne + nb personnes' });
f.decision(2);
await page.locator('.cz-sheet.show .cz-cta').click(); f.tap();

// Ouvrir le composeur d'un repas vide
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click(); f.tap();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await f.shot(page, 'composeur-vide', { screen: 'Cuisine/composeur', note: '3 briques : plat / entrée / accompagnement + total kcal' });

// Choisir le plat → picker (critère : rôle « plat »)
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click(); f.tap().decision();
await page.locator('.cz-sheet.show .cz-pick').first().waitFor({ timeout: 5000 });
await f.shot(page, 'picker-plat', { screen: 'Cuisine/picker', note: 'liste filtrée par rôle, macros par recette' });
await page.locator('.cz-sheet.show .cz-pick').first().click(); f.tap().decision();
await page.waitForTimeout(300);
await f.shot(page, 'composeur-plat-choisi', { screen: 'Cuisine/composeur', note: 'plat posé, total recalculé — entrée/acc encore vides' });

// Montrer qu'entrée + accompagnement sont des décisions SUPPLÉMENTAIRES optionnelles
const briques = page.locator('.cz-sheet.show .cz-comp .cmid');
if (await briques.count() > 1) {
  await briques.nth(1).click(); f.tap();
  await page.waitForTimeout(400);
  await f.shot(page, 'composeur-entree', { screen: 'Cuisine/picker', note: 'ajouter une entrée (2ᵉ critère)' });
}

f.writeMetrics('A3 — Composer un repas', `## Critères matérialisés (doctrine « ce qui peut devenir défaut »)
Un repas = jusqu'à **3 briques** (plat · entrée · accompagnement) + un **objectif kcal/personne**
réglable + **nb de personnes**. Pour composer UN repas minimal il faut : ouvrir → choisir un plat
(picker filtré par rôle). Entrée + accompagnement sont des décisions **supplémentaires** — déjà
optionnelles dans les faits (le plat seul suffit). Candidat : masquer entrée/acc derrière un
« + ajouter » discret, et pré-remplir l'objectif au lieu de le demander.`);

console.log(`A3 : ${f.n} états →`, dir);
await browser.close();
