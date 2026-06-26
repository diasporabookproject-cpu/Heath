// Parcours bout-en-bout du module Cuisine (nouvelle nav : Semaine / Recettes / Courses).
// Lance un build + preview avant : `npm run build && npm run preview` puis `npm run smoke`.
import { execSync } from 'node:child_process';
async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return (await import(`${root}/playwright/index.mjs`)).chromium;
  }
}
const chromium = await loadChromium();

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const errors = [];

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
// On ignore le bruit réseau externe (polices Google, backend Supabase) qui peut
// être bloqué hors-ligne / en CI : seules les vraies erreurs JS font échouer.
const IGNORE = /Failed to load resource|net::ERR_|fonts\.googleapis|gstatic|supabase\.co/i;
page.on('console', (m) => {
  if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });

// Prêt quand le résumé hebdo (vue Semaine) est affiché.
await page.getByText('Moyenne de la semaine', { exact: false }).waitFor({ timeout: 10000 });

// 1) FC2/FC3 — composer : remplir le déjeuner de Lundi via le sélecteur.
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-slot.empty').first().click();
await page.getByPlaceholder('Rechercher une recette…').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet .cz-pick').first().click();
await lundi.locator('.cz-slot:not(.empty)').first().waitFor({ timeout: 5000 });
console.log('Compose : déjeuner Lundi ajouté ✅');
await page.screenshot({ path: 'scripts/shot-semaine.png', fullPage: false });

// 2) FC1 — bascule de segments + FC5 bibliothèque.
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-librow').first().waitFor({ timeout: 5000 });
const nbRecettes = await page.locator('.cz-librow').count();
if (nbRecettes === 0) throw new Error('Bibliothèque vide');
// FAB d'ajout visible uniquement sur Recettes.
await page.locator('.cz-fab').waitFor({ timeout: 3000 });
await page.screenshot({ path: 'scripts/shot-biblio.png', fullPage: false });

// 3) FC7 — ouvrir une fiche recette (détail).
await page.locator('.cz-librow').first().click();
await page.getByText('Ingrédients', { exact: false }).first().waitFor({ timeout: 5000 });
await page.locator('.cz-sheet .cz-x').click(); // fermer
console.log('Fiche recette ouverte ✅ (', nbRecettes, 'recettes)');

// 4) FC8 — liste de courses générée depuis la semaine.
await page.getByRole('tab', { name: 'Courses' }).click();
await page.locator('.cz-coitem').first().waitFor({ timeout: 5000 });
const nbCourses = await page.locator('.cz-coitem').count();
if (nbCourses === 0) throw new Error('Liste de courses vide');
// cocher le 1er article (barré).
await page.locator('.cz-coitem').first().click();
await page.locator('.cz-coitem.done').first().waitFor({ timeout: 3000 });
await page.screenshot({ path: 'scripts/shot-courses.png', fullPage: true });
console.log('Courses : ', nbCourses, 'articles, cochage OK ✅');

// 5) Retour Semaine : la jauge/statut du jour composé s'affiche.
await page.getByRole('tab', { name: 'Semaine' }).click();
await page.getByText('Moyenne de la semaine', { exact: false }).waitFor({ timeout: 5000 });

console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');

await browser.close();
if (errors.length) process.exit(1);
