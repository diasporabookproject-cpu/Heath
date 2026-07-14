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

// F4 (Flow FTUE) : le gate pré-boot affiche la FTUE sur stockage vierge. Ce smoke
// teste le PRODUIT (la FTUE a son smoke dédié : smoke-ftue.mjs) → on la court-circuite
// PROPREMENT : visite (le gate a créé la base), pose des méta (ftueDone + rôles
// activés) puis RELOAD — écrire avant le boot serait une course, écrire-puis-recharger
// est déterministe. Zéro backdoor dans le code produit.
await page.getByText('Manzil vous aide', { exact: false }).waitFor({ timeout: 10000 });
await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('menu-semaine');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put(true, 'ftueDone');
        tx.objectStore('meta').put(['cuisine', 'nounou'], 'rolesActifs');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    }),
);
await page.reload({ waitUntil: 'networkidle' });
console.log('FTUE court-circuitée (méta posées + reload) ✅');

// 0) Hub Maison (L1-2) : entrer dans la page Cuisine depuis « Ton équipe ».
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
// F1.2 (lot Cuisine) : « Générer la semaine » n'existe plus — l'ancre de la vue
// Menu est le bouton « Copier une semaine précédente ». + porte F1.2 : zéro « Générer ».
await page.getByText('Copier une semaine précédente').waitFor({ timeout: 10000 });
if (await page.getByText('Générer la semaine').count())
  throw new Error('F1.2 : « Générer la semaine » ne doit plus exister');
console.log('Hub Maison → Cuisine (sans « Générer ») ✅');

// 0bis) F2 (Flow FTUE) : la bibliothèque démarre VIDE — le smoke installe d'abord
// la collection « Fonds de départ » (la porte teste ainsi F2 de bout en bout au
// lieu de supposer une bibliothèque pré-seedée), puis déroule le parcours habituel.
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-pkt', { hasText: 'Fonds de départ' }).click();
await page.locator('.cz-sheet.show .cz-cta').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-cta').click(); // « Ajouter les 30 recettes »
await page.locator('.cz-librow').first().waitFor({ timeout: 5000 }); // bibliothèque peuplée
console.log('Collection « Fonds de départ » installée ✅');
// F1.3 : l'onglet s'appelle désormais « Menu ».
await page.getByRole('tab', { name: 'Menu' }).click();
await page.getByText('Copier une semaine précédente').waitFor({ timeout: 5000 });

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
