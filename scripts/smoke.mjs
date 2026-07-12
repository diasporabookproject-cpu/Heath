// Parcours bout-en-bout Cuisine v2 (3 repas, composeur, objectif, courses).
// `npm run build && npm run preview` puis `npm run smoke`.
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
const IGNORE = /Failed to load resource|net::ERR_|fonts\.googleapis|gstatic|supabase\.co/i;

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });

// 0) Hub Maison (L1-2) : entrer dans la page Cuisine depuis « Ton équipe ».
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
await page.getByText('Générer la semaine').waitFor({ timeout: 10000 });
console.log('Hub Maison → Cuisine ✅');

// 0bis) F2 (Flow FTUE) : la bibliothèque démarre VIDE — le smoke installe d'abord
// la collection « Fonds de départ » (la porte teste ainsi F2 de bout en bout au
// lieu de supposer une bibliothèque pré-seedée), puis déroule le parcours habituel.
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-pkt', { hasText: 'Fonds de départ' }).click();
await page.locator('.cz-sheet.show .cz-cta').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-cta').click(); // « Ajouter les 30 recettes »
await page.locator('.cz-librow').first().waitFor({ timeout: 5000 }); // bibliothèque peuplée
console.log('Collection « Fonds de départ » installée ✅');
await page.getByRole('tab', { name: 'Semaine' }).click();
await page.getByText('Générer la semaine').waitFor({ timeout: 5000 });

// 1) FC11/FC12 — composer le petit-déjeuner de Lundi via le composeur + sélecteur.
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click(); // « Choisir » le plat
await page.locator('.cz-sheet.show .cz-pick').first().waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-pick').first().click();
await page.waitForTimeout(300);
await page.locator('.cz-sheet.show .cz-x').first().click(); // fermer le composeur
await lundi.locator('.cz-mrow:not(.empty)').first().waitFor({ timeout: 5000 });
console.log('Compose : petit-déjeuner Lundi ajouté ✅');
await page.screenshot({ path: 'scripts/shot-semaine.png', fullPage: false });

// 2) FC13 — objectif (pastille d'en-tête).
await page.locator('.cz-pill').click();
await page.getByText('Objectif par personne').waitFor({ timeout: 5000 });
await page.locator('.cz-objset button').first().click(); // -50
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
console.log('Objectif réglable ✅');

// 3) FC5 — bibliothèque (rôles + favoris).
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-librow').first().waitFor({ timeout: 5000 });
const nbRecettes = await page.locator('.cz-librow').count();
if (nbRecettes === 0) throw new Error('Bibliothèque vide');
await page.locator('.cz-chips .cz-chip', { hasText: 'Petit-déj' }).click(); // filtre par rôle
await page.waitForTimeout(200);
await page.getByRole('tab', { name: 'Recettes' }); // (reste sur Recettes)
await page.screenshot({ path: 'scripts/shot-biblio.png', fullPage: false });
console.log('Bibliothèque ✅ (', nbRecettes, 'recettes)');

// 4) FC7 — ouvrir une fiche.
await page.locator('.cz-chips .cz-chip', { hasText: 'Tous' }).click();
await page.locator('.cz-librow').first().click();
await page.getByText('Ingrédients', { exact: false }).first().waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-x').click();

// 5) FC8 — courses.
await page.getByRole('tab', { name: 'Courses' }).click();
await page.locator('.cz-coitem').first().waitFor({ timeout: 5000 });
const nbCourses = await page.locator('.cz-coitem').count();
if (nbCourses === 0) throw new Error('Liste de courses vide');
await page.screenshot({ path: 'scripts/shot-courses.png', fullPage: true });
console.log('Courses ✅ (', nbCourses, 'articles)');

console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');
await browser.close();
if (errors.length) process.exit(1);
