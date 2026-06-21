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

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone-ish
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
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
await ctx.grantPermissions(['clipboard-read', 'clipboard-write', 'microphone']);
await page.getByRole('button', { name: /Cuisinière/ }).click();
await page.getByRole('button', { name: /Copier toute la semaine/ }).click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
if (!/Lundi/.test(clip)) throw new Error('Le presse-papier ne contient pas le menu');
await page.screenshot({ path: 'scripts/shot-cuisiniere.png', fullPage: false });

// Note vocale : enregistrer (micro simulé) puis vérifier la lecture.
const vn = page.locator('.voice-note').first();
await vn.getByRole('button', { name: /Enregistrer/ }).click();
await page.getByRole('button', { name: /Arrêter/ }).first().waitFor({ timeout: 5000 });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Arrêter/ }).first().click();
await vn.locator('audio.voice-note__audio').waitFor({ timeout: 10000 });
console.log('Note vocale enregistrée + lecture OK');

// Partage par lien (sans backend) : on capture le lien puis on ouvre la page partagée.
await page.evaluate(() => {
  window.__shared = null;
  navigator.share = (d) => {
    window.__shared = d;
    return Promise.resolve();
  };
});
await page.getByRole('button', { name: /Partager le menu/ }).click();
await page.waitForFunction(() => window.__shared && window.__shared.url, { timeout: 5000 });
const shareUrl = await page.evaluate(() => window.__shared.url);
if (!shareUrl || !shareUrl.includes('#m=')) throw new Error('Lien de partage non généré');
const shared = await ctx.newPage();
await shared.goto(shareUrl, { waitUntil: 'networkidle' });
await shared.getByText('Menu de la semaine').first().waitFor({ timeout: 5000 });
const sharedBody = await shared.locator('.app__main').innerText();
if (!/Bowl poulet épinards/.test(sharedBody)) throw new Error('La page partagée ne montre pas le menu');
if (!/Note vocale — bientôt/.test(sharedBody)) throw new Error('Placeholder note vocale manquant');
await shared.screenshot({ path: 'scripts/shot-partage.png', fullPage: true });
await shared.close();
console.log('Partage lien OK (longueur du lien:', shareUrl.length, 'car.)');

// Bascule darija (lettres arabes) : rendu RTL + copie en arabe.
await page.getByRole('button', { name: 'الدارجة' }).click();
await page.locator(".cook-meal[dir='rtl']").first().waitFor({ timeout: 5000 });
await page.screenshot({ path: 'scripts/shot-cuisiniere-ar.png', fullPage: false });
await page.getByRole('button', { name: /نسخ الأسبوع/ }).click();
const clipAr = await page.evaluate(() => navigator.clipboard.readText());
if (!/الإثنين/.test(clipAr)) throw new Error('La copie darija ne contient pas le jour en arabe');
console.log('Copie darija (extrait):', clipAr.slice(0, 40).replace(/\n/g, ' ⏎ '));

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

// 6) Édition : changer le type du Rôti de bœuf (Dîner -> Déjeuner).
const roti = page.locator('.lib-item', { hasText: 'Rôti de bœuf' });
await roti.locator('.lib-item__edit').click();
await page.getByText('Modifier la recette').waitFor({ timeout: 5000 });
await page.locator('.sheet select').first().selectOption('Déjeuner');
await page.getByRole('button', { name: /Enregistrer les modifications/ }).click();
const sub = await page
  .locator('.lib-item', { hasText: 'Rôti de bœuf' })
  .locator('.lib-item__sub')
  .innerText();
if (!/Déjeuner/.test(sub)) throw new Error("Le changement de type n'a pas été appliqué");
console.log('Édition type OK →', sub.split('·')[0].trim());

console.log('Avant choix, totaux Lundi:', kcalAvant?.replace(/\s+/g, ' ').trim());
console.log('Presse-papier (extrait):', clip.slice(0, 60).replace(/\n/g, ' ⏎ '));
console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');

await browser.close();
if (errors.length) process.exit(1);
