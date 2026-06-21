// Playwright peut être installé en local ou globalement selon l'environnement.
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

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone-ish
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });

// L'app est prête quand le bandeau moyenne semaine est affiché.
await page.getByText('Moyenne de la semaine', { exact: false }).waitFor({ timeout: 10000 });

// 1) Composer : choisir un déjeuner pour Lundi.
const lundi = page.locator('.daycard', { hasText: 'Lundi' });
await lundi.locator('.slot', { hasText: 'Déjeuner' }).click();
await page.getByPlaceholder('Rechercher une recette…').waitFor();
const kcalAvant = await lundi.locator('.stat--vert, .stat--orange, .stat--rouge').first().textContent();
await page.locator('.reci', { hasText: 'Bowl poulet épinards' }).click(); // DEJ-07, champion calcium
// 2) Choisir un dîner.
await lundi.locator('.slot', { hasText: 'Dîner' }).click();
await page.locator('.reci').first().click();

// Vérifie que le slot affiche bien la recette choisie.
const dejText = await lundi.locator('.slot', { hasText: 'Déjeuner' }).innerText();
if (!/Bowl poulet épinards/.test(dejText)) throw new Error('Le déjeuner choisi ne s\'affiche pas');

await page.screenshot({ path: 'scripts/shot-composer.png', fullPage: false });

// 3) Onglet Cuisinière + test du bouton Copier.
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.getByRole('button', { name: /Cuisinière/ }).click();
await page.getByRole('button', { name: /Copier toute la semaine/ }).click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
if (!/Lundi/.test(clip)) throw new Error('Le presse-papier ne contient pas le menu');
await page.screenshot({ path: 'scripts/shot-cuisiniere.png', fullPage: false });

// 4) Onglet Courses : liste de courses auto-générée.
await page.getByRole('button', { name: /Courses/ }).click();
await page.locator('.course-item').first().waitFor({ timeout: 5000 });
const nbCourses = await page.locator('.course-item').count();
if (nbCourses === 0) throw new Error('La liste de courses est vide');
await page.screenshot({ path: 'scripts/shot-courses.png', fullPage: true });

// 5) Onglet Recettes.
await page.getByRole('button', { name: /Recettes/ }).click();
await page.screenshot({ path: 'scripts/shot-biblio.png', fullPage: false });
console.log('Articles liste de courses:', nbCourses);

console.log('Avant choix, totaux Lundi:', kcalAvant?.replace(/\s+/g, ' ').trim());
console.log('Presse-papier (extrait):', clip.slice(0, 60).replace(/\n/g, ' ⏎ '));
console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');

await browser.close();
if (errors.length) process.exit(1);
