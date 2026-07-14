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

// F2.1/F2.2 (lot Cuisine) — porte « opt-in nutrition » : OFF PAR DÉFAUT, donc
// ZÉRO « kcal » à l'écran tant que « Suivi de l'équilibre » n'est pas activé.
const assertNoKcal = async (ou) => {
  const n = await page.getByText(/kcal/i).count();
  if (n) throw new Error(`F2.2 : ${n} « kcal » visibles (${ou}) alors que le suivi est OFF`);
};
await assertNoKcal('vue Menu, arrivée');

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
// (F2.2 : « Total du repas » n'existe plus quand le suivi est OFF — ancre = la
// rangée de composant « Choisir ».)
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click();
await page.locator('.cz-sheet.show .cz-comp').first().waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click(); // « Choisir » le plat
await page.locator('.cz-sheet.show .cz-pick').first().waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-pick').first().click();
await page.waitForTimeout(300);
await page.locator('.cz-sheet.show .cz-x').first().click(); // fermer le composeur
await lundi.locator('.cz-mrow:not(.empty)').first().waitFor({ timeout: 5000 });
console.log('Compose : petit-déjeuner Lundi ajouté ✅');
await assertNoKcal('vue Menu, repas composé'); // même rempli : rien tant que OFF
await page.screenshot({ path: 'scripts/shot-semaine.png', fullPage: false });

// 2) F2.1 + FC13 — Réglages ⚙ : OFF par défaut → ON restitue tout (pastille +
// objectif réglable) → OFF re-masque tout. Le nombre de personnes reste toujours là.
if (await page.locator('.cz-pill').count())
  throw new Error('F2.2 #5 : la pastille Objectif ne doit pas exister quand le suivi est OFF');
await page.getByLabel('Réglages Cuisine').click();
await page.getByText('Suivi de l’équilibre').first().waitFor({ timeout: 5000 });
await page.getByText('Nombre de personnes', { exact: true }).waitFor({ timeout: 3000 }); // valeur foyer : toujours visible
if (await page.getByText('Objectif par personne').count())
  throw new Error('F2.2 #6 : la section objectif doit être masquée quand le suivi est OFF');
// (T3 : la feuille porte désormais 3 interrupteurs — cibler par aria-label.)
const suiviSwitch = page.getByRole('switch', { name: 'Suivi de l’équilibre' });
await suiviSwitch.click(); // ON
await page.getByText('Objectif par personne').waitFor({ timeout: 3000 });
await page.locator('.cz-objset button').first().click(); // -50
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
await page.locator('.cz-pill', { hasText: 'kcal/pers.' }).waitFor({ timeout: 5000 }); // ON → pastille de retour
console.log('Suivi de l’équilibre ON → objectif réglable, pastille visible ✅');
await page.getByLabel('Réglages Cuisine').click();
await suiviSwitch.click(); // OFF
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
await page.waitForTimeout(300);
await assertNoKcal('retour OFF');
console.log('Suivi de l’équilibre OFF → zéro nutrition (porte F2.2) ✅');

// 2bis) T3 (F3.1/F3.2) — restrictions du foyer : pose (halal + allergie), résumé
// G1 affiché, puis PERSISTANCE prouvée après un reload complet (IDB v9).
await page.getByLabel('Réglages Cuisine').click();
await page.getByText('Restrictions du foyer').waitFor({ timeout: 5000 });
await page.getByRole('switch', { name: 'Halal' }).click();
await page.locator('.cz-sheet.show textarea').fill('arachide');
await page.locator('.cz-sheet.show textarea').blur();
await page.getByText('Règles actives : halal · sans arachide').waitFor({ timeout: 3000 }); // G1
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
await page.getByText('Copier une semaine précédente').waitFor({ timeout: 10000 });
await page.getByLabel('Réglages Cuisine').click();
await page.getByText('Règles actives : halal · sans arachide').waitFor({ timeout: 5000 });
const halalOn = await page.getByRole('switch', { name: 'Halal' }).getAttribute('aria-checked');
if (halalOn !== 'true') throw new Error('T3 : halal non persisté après reload');
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
console.log('Restrictions du foyer : posées, affichées (G1), persistées au reload ✅');

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

// 3bis) T4a (F4.1/F4.2, GO ③) — FAB → feuille des 3 voies (langage banni ABSENT),
// « L'écrire » crée une recette Validé qui atterrit dans la bibliothèque.
await page.locator('.cz-chips .cz-chip', { hasText: 'Tous' }).click();
await page.locator('.cz-fab').click();
await page.getByText('Comment on l’ajoute ?').waitFor({ timeout: 5000 });
for (const voie of ['L’écrire', 'À partir d’instructions', 'Depuis une collection']) {
  if (!(await page.getByText(voie, { exact: false }).count()))
    throw new Error(`F4.1 : voie « ${voie} » absente de la feuille`);
}
const voiesTxt = await page.locator('.cz-sheet.show').last().innerText();
if (/\bIA\b|Générer|génération|✨/i.test(voiesTxt))
  throw new Error('GO T4 ③ : langage banni (IA/Générer/✨) présent dans la feuille des voies');
console.log('Feuille des 3 voies : complète, zéro langage banni ✅');
await page.getByText('L’écrire', { exact: false }).click();
await page.getByText('Portions', { exact: true }).waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-inp').first().fill('Soupe du smoke');
await page.locator('.cz-sheet.show textarea').first().fill('courgette 200 g\nune bonne pincée de cumin');
await page.locator('.cz-sheet.show').getByText('Enregistrer', { exact: true }).click();
await page.waitForTimeout(600);
await page.locator('.cz-sheet.show .cz-x').last().click(); // fermer la fiche ouverte
await page.locator('.cz-librow', { hasText: 'Soupe du smoke' }).waitFor({ timeout: 5000 });
console.log('« L’écrire » : recette créée (Validé), dans la bibliothèque ✅');

// 3ter) Amendement ② — « ＋ Nouvelle recette » DANS le sélecteur de composant :
// création avec rôle pré-rempli → prend directement le créneau (geste fini).
await page.getByRole('tab', { name: 'Menu' }).click();
const mardi = page.locator('.cz-daycard', { hasText: 'Mardi' });
await mardi.locator('.cz-mrow.empty').first().click();
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click(); // « Choisir »
await page.locator('.cz-sheet.show').last().getByText('Nouvelle recette').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show').last().getByText('Nouvelle recette').click();
await page.getByText('Comment on l’ajoute ?').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show').last().getByText('L’écrire', { exact: false }).click();
await page.getByText('Portions', { exact: true }).waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show').last().locator('.cz-inp').first().fill('Œufs du picker');
await page.locator('.cz-sheet.show').last().locator('textarea').first().fill('œufs 2\nune noisette de beurre');
await page.locator('.cz-sheet.show').last().getByText('Enregistrer', { exact: true }).click();
await page.getByText('Recette créée et ajoutée au repas').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-x').first().click().catch(() => {}); // fermer le composeur
await page.waitForTimeout(400);
await mardi.getByText('Œufs du picker').waitFor({ timeout: 5000 });
console.log('Amendement ② : créée depuis le sélecteur, posée dans le créneau ✅');

// 4) FC7 — ouvrir une fiche.
await page.getByRole('tab', { name: 'Recettes' }).click();
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
