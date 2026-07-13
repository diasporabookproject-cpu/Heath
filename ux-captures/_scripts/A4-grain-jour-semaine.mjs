// A4 — Grain jour vs semaine (friction PO : « vues calendrier lourdes, parfois on veut
// juste partager une journée »). Le chemin « ne partager qu'un jour » existe-t-il, combien coûte-t-il ?
import { open, Film, bypassFtue, installCollection, createCuisineDest } from './lib.mjs';

const dir = 'ux-captures/A-flux/A4-grain-jour-semaine';
const { browser, page } = await open();
const f = new Film(dir);

await bypassFtue(page);
await installCollection(page);
await page.getByRole('tab', { name: 'Semaine' }).click();

// La vue semaine complète (7 jours × 3 repas)
await f.shot(page, 'semaine-complete', { screen: 'Cuisine/semaine', note: 'grille 7 jours, moyenne/jour, générer' });

// Composer lundi pour avoir un jour à partager
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click();
await page.locator('.cz-sheet.show .cz-pick').first().click();
await page.waitForTimeout(300);
await page.locator('.cz-sheet.show .cz-x').first().click();
await lundi.locator('.cz-mrow:not(.empty)').first().waitFor({ timeout: 5000 });
await f.shot(page, 'un-jour-composé', { screen: 'Cuisine/semaine', note: 'une carte-jour = lundi' });

// Le chemin « partager un seul jour » : créer un destinataire d'abord (friction A2),
// puis la feuille de partage → portée « Un jour… »
await createCuisineDest(page, 'Fatima'); f.tap().decision();
await page.waitForTimeout(300);
await f.shot(page, 'partage-portee-semaine', { screen: 'Cuisine/partage', note: 'défaut = La semaine (les 4 portées visibles)' });
const unJour = page.locator('.cz-sheet.show').getByText('Un jour', { exact: false }).first();
if (await unJour.count()) {
  await unJour.click(); f.tap().decision();
  await page.waitForTimeout(400);
  await f.shot(page, 'partage-portee-unjour', { screen: 'Cuisine/partage', note: 'sélecteur de jour révélé — chemin EXISTE (portée du partage)' });
}

f.writeMetrics('A4 — Grain jour vs semaine', `## Constat
Le chemin « ne partager qu'un jour » **existe** — mais UNIQUEMENT dans la feuille de partage
(portée « Un jour… », rang 2, après avoir choisi de partager). Il n'y a **pas** de vue « jour »
autonome ni de « partager ce jour » depuis une carte-jour du calendrier. Coût actuel pour
partager juste aujourd'hui : ouvrir le partage → changer la portée (défaut = La semaine) →
choisir le jour. Candidat doctrine : un raccourci « partager ce jour » sur la carte-jour, et/ou
« Aujourd'hui » comme portée par défaut selon le contexte.`);

console.log(`A4 : ${f.n} états →`, dir);
await browser.close();
