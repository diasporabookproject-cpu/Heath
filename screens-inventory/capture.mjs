// Inventaire visuel — capture Playwright de tous les écrans/feuilles de l'app.
// Lecture seule côté app : on ne touche pas à src, on build + preview + capture.
import { execSync } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';

async function loadChromium() {
  try { return (await import('playwright')).chromium; }
  catch {
    const root = execSync('npm root -g').toString().trim();
    return (await import(`${root}/playwright/index.mjs`)).chromium;
  }
}
const chromium = await loadChromium();

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = process.env.OUT_DIR;
const LEGEND = `${OUT}/legende.txt`;
writeFileSync(LEGEND, `INVENTAIRE DES ÉCRANS — ${new Date().toISOString()}\n` +
  `Viewport 390×844 @2x — build de prod servi par vite preview.\n` +
  `${'='.repeat(72)}\n\n`);

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  ignoreHTTPSErrors: true,
  locale: 'fr-FR',
});
const page = await ctx.newPage();
const consoleErrs = [];
const IGNORE = /Failed to load resource|net::ERR_|fonts\.googleapis|gstatic|supabase\.co|manifest|sw\.js|workbox/i;
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) consoleErrs.push(m.text()); });
page.on('pageerror', (e) => consoleErrs.push('pageerror: ' + e.message));

const results = [];
const problems = [];

async function snapText() {
  try {
    return await page.evaluate(() => {
      // Texte de la feuille ouverte en priorité, sinon tout le corps.
      const sheet = document.querySelector('.cz-sheet.show, .sheet, .mz-sheet');
      const t = (sheet && sheet.innerText) || document.body.innerText;
      return t.replace(/\n{2,}/g, '\n').trim();
    });
  } catch { return '(texte indisponible)'; }
}

// Capture nommée + légende (rôle/accès) + dump innerText.
async function shot(file, role, acces) {
  await page.waitForTimeout(350);
  const path = `${OUT}/${file}`;
  await page.screenshot({ path, fullPage: false });
  const txt = await snapText();
  results.push({ file, role, acces });
  appendFileSync(LEGEND,
    `### ${file}\n` +
    `Rôle   : ${role}\n` +
    `Accès  : ${acces}\n` +
    `Texte visible :\n${txt}\n` +
    `${'-'.repeat(72)}\n\n`);
  console.log('✔', file);
}

function note(msg) { problems.push(msg); console.log('⚠', msg); }

async function goHome() {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByText('Ton équipe').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
}

// Ferme toute feuille ouverte (bouton × standard ou backdrop).
async function closeSheet() {
  try {
    const x = page.locator('.cz-sheet.show .cz-x, .sheet .sheet__close').first();
    if (await x.count()) { await x.click({ timeout: 2000 }); await page.waitForTimeout(300); return; }
  } catch {}
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
}

// Entre dans la page Cuisine depuis le hub (ligne « Cuisine » de Ton équipe).
async function enterCuisine() {
  await goHome();
  await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
  await page.getByText('Générer la semaine').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
}
async function enterNounou() {
  await goHome();
  // La carte nounou porte le prénom (Khadija) + rôle Nounou.
  const row = page.locator('.mz-prow', { hasText: 'Nounou' }).first();
  await row.click();
  await page.locator('.cz-nounou').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
}

try {
  // ========================= HUB MAISON =========================
  await goHome();
  await shot('01-maison-hub.png', 'Écran racine (hub) — Aujourd’hui, Ton équipe, La maison',
    'Écran d’accueil de l’app');

  // Feuille « Une page pour quelqu’un d’autre »
  try {
    await page.getByText('Une page pour quelqu’un d’autre').click({ timeout: 5000 });
    await page.getByText('Entretien').waitFor({ timeout: 5000 });
    await shot('02-maison-nouvelle-page.png', 'Feuille : ajouter une page de rôle (Entretien/Chauffeur/…)',
      'Hub → bouton « ＋ Une page pour quelqu’un d’autre »');
    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.click(195, 60); // clic hors feuille au cas où
    await page.waitForTimeout(300);
  } catch (e) { note('02 nouvelle-page: ' + e.message); }

  // Feuille Compte / réglages (☁︎)
  try {
    await goHome();
    await page.locator('.mz-av').first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await shot('03-compte-reglages.png', 'Feuille : Compte & synchro (Supabase), export, réglages',
      'Hub → avatar ☁︎ en haut à droite');
    await closeSheet();
  } catch (e) { note('03 compte: ' + e.message); }

  // ========================= CUISINE =========================
  await enterCuisine();
  await shot('10-cuisine-semaine.png', 'Cuisine › onglet Semaine — planning des repas + jauges kcal',
    'Hub → carte « Cuisine »');

  // Composeur de repas (clic sur un repas vide d’un jour)
  try {
    await page.locator('.cz-mrow.empty').first().click({ timeout: 5000 });
    await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    await shot('11-cuisine-composeur-repas.png', 'Feuille : composeur d’un repas (entrée/plat/accompagnement + total)',
      'Cuisine › Semaine → tap sur un créneau de repas');

    // Sélecteur de recette (« Choisir » un composant)
    try {
      await page.locator('.cz-sheet.show .cmid').first().click({ timeout: 4000 });
      await page.locator('.cz-sheet.show .cz-pick, .cz-sheet.show .cz-librow').first().waitFor({ timeout: 5000 });
      await page.waitForTimeout(400);
      await shot('12-cuisine-choix-recette.png', 'Feuille : sélecteur de recette (liste filtrée par rôle)',
        'Composeur → « Choisir » un composant');
    } catch (e) { note('12 choix-recette: ' + e.message); }
    await goHome();
  } catch (e) { note('11 composeur: ' + e.message); }

  // Bibliothèque (onglet Recettes)
  await enterCuisine();
  try {
    await page.getByRole('tab', { name: 'Recettes' }).click({ timeout: 5000 });
    await page.locator('.cz-librow').first().waitFor({ timeout: 5000 });
    await shot('13-cuisine-bibliotheque.png', 'Cuisine › onglet Recettes — bibliothèque (chips de rôle, favoris, macros)',
      'Cuisine → onglet « Recettes »');

    // Fiche recette (détail)
    try {
      await page.locator('.cz-librow').first().click({ timeout: 4000 });
      await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot('14-cuisine-fiche-recette.png', 'Feuille : détail d’une recette (ingrédients, macros, calcium, voix)',
        'Bibliothèque → tap sur une recette');
      await closeSheet();
    } catch (e) { note('14 fiche-recette: ' + e.message); }

    // Feuille d’ajout de recette (FAB +)
    try {
      await page.locator('.cz-fab').click({ timeout: 4000 });
      await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot('15-cuisine-ajout-recette.png', 'Feuille : ajouter une recette (saisie manuelle / JSON / import)',
        'Cuisine › Recettes → bouton flottant ＋');

      // Depuis l’ajout, ouvrir Collections
      try {
        await page.locator('.cz-sheet.show .cz-opt2').first().click({ timeout: 4000 });
        await page.waitForTimeout(600);
        await shot('16-cuisine-collections.png', 'Feuille : Collections (packs de recettes à copier chez soi)',
          'Feuille d’ajout → « Collections » (aussi accessible via le rail en bas des Recettes)');
        await closeSheet();
      } catch (e) { note('16 collections: ' + e.message); }
      await closeSheet();
    } catch (e) { note('15 ajout-recette: ' + e.message); }
  } catch (e) { note('13 bibliotheque: ' + e.message); }

  // Courses
  await enterCuisine();
  try {
    await page.getByRole('tab', { name: 'Courses' }).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await shot('17-cuisine-courses.png', 'Cuisine › onglet Courses — liste de courses agrégée depuis la semaine',
      'Cuisine → onglet « Courses »');
  } catch (e) { note('17 courses: ' + e.message); }

  // Objectif (pastille d’en-tête)
  await enterCuisine();
  try {
    await page.locator('.cz-pill').first().click({ timeout: 5000 });
    await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    await shot('18-cuisine-objectif.png', 'Feuille : réglage de l’objectif kcal/personne',
      'Cuisine → pastille « Objectif … kcal/pers. »');
    await closeSheet();
  } catch (e) { note('18 objectif: ' + e.message); }

  // Partage (icône partage d’en-tête)
  await enterCuisine();
  try {
    await page.locator('.cz-headicon[aria-label="Partager le menu"]').click({ timeout: 5000 });
    await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
    await page.waitForTimeout(600);
    await shot('19-cuisine-partage.png', 'Feuille : partager le menu (créer une page/lien pour un destinataire)',
      'Cuisine → icône ⤴ « Partager le menu »');
    await closeSheet();
  } catch (e) { note('19 partage: ' + e.message); }

  // Copier la semaine
  await enterCuisine();
  try {
    await page.locator('.cz-subgen').first().click({ timeout: 5000 });
    await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    await shot('20-cuisine-copier-semaine.png', 'Feuille : copier une semaine passée vers la semaine courante',
      'Cuisine › Semaine → « Copier une semaine »');
    await closeSheet();
  } catch (e) { note('20 copier-semaine: ' + e.message); }

  // État vide : semaine suivante (souvent vide)
  await enterCuisine();
  try {
    await page.locator('.cz-navchev[aria-label="Suivante"]').click({ timeout: 5000 });
    await page.waitForTimeout(700);
    await shot('21-cuisine-semaine-vide.png', 'État vide : semaine sans repas (message « Semaine vide »)',
      'Cuisine › Semaine → chevron « Suivante »');
  } catch (e) { note('21 semaine-vide: ' + e.message); }

  // ========================= NOUNOU =========================
  await enterNounou();
  await shot('30-nounou-journee.png', 'Nounou › onglet Journée — déroulé horaire (bandeau période, événements)',
    'Hub → carte « Khadija · Nounou »');

  try {
    await page.getByRole('tab', { name: 'Conduites' }).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await shot('31-nounou-conduites.png', 'Nounou › onglet Conduites — protocoles/règles (chips, à compléter)',
      'Nounou → onglet « Conduites »');
  } catch (e) { note('31 conduites: ' + e.message); }

  try {
    await page.getByRole('tab', { name: 'Fiche urgence' }).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await shot('32-nounou-fiche-urgence.png', 'Nounou › onglet Fiche urgence — numéros, contacts, enfants',
      'Nounou → onglet « Fiche urgence »');
  } catch (e) { note('32 fiche-urgence: ' + e.message); }

  // Partage nounou
  await enterNounou();
  try {
    await page.locator('.cz-headicon[aria-label="Partager la page"]').click({ timeout: 5000 });
    await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
    await page.waitForTimeout(600);
    await shot('33-nounou-partage.png', 'Feuille : partager la page Nounou (destinataire, langue/traduction)',
      'Nounou → icône ⤴ « Partager la page »');
    await closeSheet();
  } catch (e) { note('33 nounou-partage: ' + e.message); }

  // ========================= LA MAISON / SÉCURITÉ =========================
  await goHome();
  try {
    await page.locator('.mz-prow', { hasText: 'La maison' }).first().click({ timeout: 5000 });
    await page.getByText('Sécurité du foyer').waitFor({ timeout: 8000 });
    await page.waitForTimeout(600);
    await shot('40-securite-vide.png', 'La maison / Sécurité — référentiel (état initial, avant import)',
      'Hub → carte « La maison »');
    // Importer le référentiel de démarrage pour montrer l’état rempli
    try {
      await page.getByRole('button', { name: /Importer|Charger|référentiel|démarrage/i }).first().click({ timeout: 4000 });
      await page.waitForTimeout(900);
      await shot('41-securite-rempli.png', 'La maison / Sécurité — référentiel rempli (fiches par section)',
        'La maison → « Importer » le référentiel de démarrage');
    } catch (e) { note('41 securite-rempli: ' + e.message); }
  } catch (e) { note('40 securite: ' + e.message); }

  // ========================= ESPACE DESTINATAIRE (lecture seule) =========================
  try {
    await page.goto(`${BASE}/#e=demo-token-inexistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await shot('50-espace-destinataire-vide.png', 'Vue destinataire (#e=) — état vide/indisponible (lien reçu par un tiers)',
      'Ouverture d’un lien « Mon espace » avec un jeton invalide');
  } catch (e) { note('50 espace: ' + e.message); }

} catch (fatal) {
  note('FATAL: ' + (fatal && fatal.stack || fatal));
} finally {
  // Résumé + problèmes en fin de légende
  appendFileSync(LEGEND, `\n${'='.repeat(72)}\nRÉSUMÉ : ${results.length} captures.\n`);
  if (problems.length) {
    appendFileSync(LEGEND, `\nÉCRANS/FEUILLES QUI ONT RÉSISTÉ (à compléter par lecture de code) :\n`);
    for (const p of problems) appendFileSync(LEGEND, `  - ${p}\n`);
  } else {
    appendFileSync(LEGEND, `Aucune capture n’a échoué.\n`);
  }
  if (consoleErrs.length) {
    appendFileSync(LEGEND, `\nERREURS CONSOLE (hors réseau/Supabase) :\n`);
    for (const e of [...new Set(consoleErrs)]) appendFileSync(LEGEND, `  - ${e}\n`);
  }
  console.log(`\n${results.length} captures, ${problems.length} problèmes.`);
  await browser.close();
}
