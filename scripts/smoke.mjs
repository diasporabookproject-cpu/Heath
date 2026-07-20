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

// 0) Hub Maison (B1 DA v2) : entrer dans la page Cuisine depuis le héros « La Cuisine ».
await page.getByText('Votre foyer').waitFor({ timeout: 10000 });
await page.locator('.b1-cuihero').click();
// F1.2 (lot Cuisine) : « Générer la semaine » n'existe plus — l'ancre de la vue
// Menu est le bouton « Copier une semaine précédente ». + porte F1.2 : zéro « Générer ».
// T7/F7.2 — portes structurelles : DÉFAUT = DEMAIN (vue jour), UNE seule barre
// (l'en-tête n'a plus d'onglets, la nav vit au footer).
await page.locator('.cz-weekbtn').waitFor({ timeout: 10000 });
// DA v2 (T2) : le jour sélectionné par défaut dans la bande = DEMAIN (sa date).
const demainDate = String(new Date(Date.now() + 86400000).getDate());
const selDn = await page.locator('.cz-day.on .dn').textContent();
if (selDn !== demainDate) throw new Error(`F7.2 : le défaut doit être Demain (sélection ${selDn}, attendu ${demainDate})`);
if (await page.locator('.cz-head [role="tab"]').count())
  throw new Error('F7.2 : l’en-tête ne doit plus porter d’onglets (une seule barre)');
await page.locator('.cz-footbar').waitFor({ timeout: 3000 });
console.log('F7.2 : défaut Demain, une seule barre (footer) ✅');
// bascule Semaine pour dérouler le parcours historique
if (!(await page.locator('.cz-weekbtn.on').count())) await page.locator('.cz-weekbtn').click(); // toggle → idempotent
await page.getByText('Copier une semaine précédente').waitFor({ timeout: 5000 });
if (await page.getByText('Générer la semaine').count())
  throw new Error('F1.2 : « Générer la semaine » ne doit plus exister');
console.log('Hub Maison → Cuisine (sans « Générer ») ✅');

// Lot simplification — porte « la nutrition est SORTIE » : ZÉRO « kcal » à
// l'écran, NULLE PART, jamais (plus de flag, plus d'opt-in — c'est parti).
// Complète la porte grep statique (kcal|macro|calcium|prot dans le code).
const assertNoKcal = async (ou) => {
  const n = await page.getByText(/kcal/i).count();
  if (n) throw new Error(`Nutrition SORTIE : ${n} « kcal » visibles (${ou}) — la purge a un trou`);
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
// T5 (SPEC 6) — les chips MEURENT, les collections vivent EN BAS (« Besoin
// d'inspiration ? ») ; le repère emoji reste ; plus jamais de rail en tête.
if (await page.locator('.cz-chips').count())
  throw new Error('T5 : les chips de filtre doivent avoir disparu (sections par moment)');
if (await page.locator('.cz-rail').count() || await page.locator('.cz-collline').count())
  throw new Error('T5 : plus de rail ni de ligne Collections en tête — elles vivent en bas');
await page.locator('.cz-inspi').waitFor({ timeout: 3000 });
if (!(await page.locator('.cz-remoji').count()))
  throw new Error('F7.1 : repère emoji absent des cartes');
console.log('T5 : chips mortes, collections en bas (inspiration), repères emoji ✅');
// F1.3 : l'onglet s'appelle désormais « Menu ».
await page.getByRole('tab', { name: 'Menu' }).click();
if (!(await page.locator('.cz-weekbtn.on').count())) await page.locator('.cz-weekbtn').click(); // toggle → idempotent
await page.getByText('Copier une semaine précédente').waitFor({ timeout: 5000 });

// 1) T4 (SPEC 5) — créneau VIDE → RADIAL (3 pétales) → « Ma bibliothèque »
// → sélecteur → pick. Puis créneau PLEIN → COMPOSEUR direct : le radial
// précède le composeur, il ne le contourne pas (porte du read-back).
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click();
await page.locator('.cz-radial.show').waitFor({ timeout: 5000 });
if ((await page.locator('.cz-petal').count()) !== 3)
  throw new Error('SPEC 5 : le radial doit avoir TROIS pétales, jamais 4');
// Q5 : bibliothèque remplie → le pétale « Ma bibliothèque » est le PREMIER (gauche, côté pouce).
const firstPetal = await page.locator('.cz-petal .pl').first().textContent();
if (!/bibliothèque/i.test(firstPetal ?? '')) throw new Error(`Q5 : pétale gauche = Ma bibliothèque (lu : ${firstPetal})`);
await page.locator('.cz-petal', { hasText: 'Ma bibliothèque' }).click();
await page.locator('.cz-sheet.show .cz-pick').first().waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-pick').first().click();
await lundi.locator('.cz-mrow:not(.empty)').first().waitFor({ timeout: 5000 });
console.log('T4 : radial (3 pétales, biblio à gauche) → sélecteur → créneau rempli ✅');
// Créneau PLEIN → le composeur s'ouvre directement (multi-composant intact).
await lundi.locator('.cz-mrow:not(.empty)').first().click();
await page.locator('.cz-sheet.show .cz-comp').first().waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-x').first().click();
await page.waitForTimeout(300);
console.log('T4 : créneau plein → composeur direct (le radial ne contourne pas) ✅');
await assertNoKcal('vue Menu, repas composé');
await page.screenshot({ path: 'scripts/shot-semaine.png', fullPage: false });

// 2) Réglages ⚙ (lot simplification) : plus de « Suivi de l'équilibre » ni
// d'objectif — le nombre de personnes reste ; les restrictions du foyer sont UN
// SEUL champ (« Ce que le foyer ne mange pas »), plus de toggle Végétarien.
if (await page.locator('.cz-pill').count())
  throw new Error('Nutrition SORTIE : la pastille Objectif ne doit plus exister');
await page.getByLabel('Réglages Cuisine').click();
await page.getByText('Nombre de personnes', { exact: true }).waitFor({ timeout: 5000 });
if (await page.getByText('Suivi de l’équilibre').count())
  throw new Error('Nutrition SORTIE : « Suivi de l’équilibre » ne doit plus exister');
if (await page.getByText('Objectif par personne').count())
  throw new Error('Nutrition SORTIE : la section objectif ne doit plus exister');
if (await page.getByText('Végétarien', { exact: true }).count())
  throw new Error('Fusion régime : le toggle Végétarien doit avoir fondu dans le champ unique');
await page.getByText('Ce que le foyer ne mange pas', { exact: false }).waitFor({ timeout: 3000 });
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
await page.waitForTimeout(300);
await assertNoKcal('après Réglages');
console.log('Réglages : nutrition sortie, restrictions en un seul champ ✅');

// 2bis) Restrictions du foyer (lot simplification : UN champ) — pose halal +
// G1 affiché, puis PERSISTANCE prouvée après un reload complet (IDB v9).
await page.getByLabel('Réglages Cuisine').click();
await page.getByText('Restrictions du foyer').waitFor({ timeout: 5000 });
await page.getByRole('switch', { name: 'Halal' }).click();
await page.locator('.cz-sheet.show textarea').fill('arachide');
await page.locator('.cz-sheet.show textarea').blur();
await page.getByText('Règles actives : halal · arachide').waitFor({ timeout: 3000 }); // G1
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Votre foyer').waitFor({ timeout: 10000 });
await page.locator('.b1-cuihero').click();
await page.locator('.cz-weekbtn').waitFor({ timeout: 10000 });
await page.getByLabel('Réglages Cuisine').click();
await page.getByText('Règles actives : halal · arachide').waitFor({ timeout: 5000 });
const halalOn = await page.getByRole('switch', { name: 'Halal' }).getAttribute('aria-checked');
if (halalOn !== 'true') throw new Error('T3 : halal non persisté après reload');
await page.locator('.cz-sheet.show .cz-cta').click(); // OK
console.log('Restrictions du foyer : posées, affichées (G1), persistées au reload ✅');

// 3) FC5 (T5) — bibliothèque : SECTIONS PAR MOMENT (Q3 ordre des repas,
// Q4 dépliées par défaut, repliables) + favoris opérants (étoile + toggle).
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-librow').first().waitFor({ timeout: 5000 });
const nbRecettes = await page.locator('.cz-librow').count();
if (nbRecettes === 0) throw new Error('Bibliothèque vide');
await page.locator('.cz-sech', { hasText: 'Plats' }).waitFor({ timeout: 3000 }); // sections présentes
await page.locator('.cz-sech', { hasText: 'Plats' }).click(); // replier
await page.waitForTimeout(200);
const nbApresRepli = await page.locator('.cz-librow').count();
if (nbApresRepli >= nbRecettes) throw new Error('Q4 : replier une section doit cacher ses lignes');
await page.locator('.cz-sech', { hasText: 'Plats' }).click(); // redéplier
await page.waitForTimeout(200);
// Favoris opérants : étoile sur la 1ʳᵉ ligne → toggle favoris → elle seule reste.
await page.locator('.cz-librow .cz-starbtn').first().click();
await page.locator('.cz-startog').click();
await page.waitForTimeout(200);
if ((await page.locator('.cz-librow').count()) !== 1)
  throw new Error('T5 : le toggle favoris doit ne montrer que les recettes étoilées');
await page.locator('.cz-startog').click(); // retour
await page.locator('.cz-librow .cz-starbtn').first().click(); // dé-étoiler
await page.waitForTimeout(200);
await page.screenshot({ path: 'scripts/shot-biblio.png', fullPage: false });
console.log('T5 : sections par moment (repliables) + favoris opérants ✅ (', nbRecettes, 'recettes)');

// 3ter) T2a (lot simplification) — bandeau de relecture v2 : on INJECTE en IDB un
// brouillon avec le RAPPORT du prompt v2 (adaptations + alerte du garde G3) et on
// vérifie qu'il s'affiche à la relecture (tolérance : le champ est optionnel).
await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('menu-semaine');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('recipes', 'readwrite');
        tx.objectStore('recipes').put({
          id: 'SMOKE-V2',
          nom: 'Tajine du smoke (adapté)',
          role: 'plat',
          statut: 'Test',
          origineIA: true,
          ingredients: 'poulet 200 g · graines de courge 20 g',
          adapteSelon: ['sans arachide'],
          adaptations: [{ regle: 'sans arachide', action: 'cacahuètes remplacées par graines de courge' }],
          alerte_regles: ['"arachide" présent dans les ingrédients malgré la règle du foyer'],
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    }),
);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.b1-cuihero').click();
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-librow.draft', { hasText: 'Tajine du smoke' }).first().click();
await page.getByText('Adapté', { exact: false }).first().waitFor({ timeout: 5000 });
await page.getByText('cacahuètes remplacées par graines de courge', { exact: false }).waitFor({ timeout: 3000 });
await page.locator('.cz-relwarn', { hasText: 'arachide' }).first().waitFor({ timeout: 3000 }); // garde G3 serveur
// Ferme la relecture ET nettoie l'injection : « Supprimer » écarte le brouillon
// (file de 1 → terminée → feuille fermée).
await page.locator('.cz-sheet.show').getByText('Supprimer', { exact: true }).click();
await page.waitForTimeout(400);
console.log('T2a : bandeau de relecture v2 (rapport + alerte G3) affiché ✅');

// 3bis) T4a (F4.1/F4.2, GO ③) — FAB → feuille des 3 voies (langage banni ABSENT),
// « L'écrire » crée une recette Validé qui atterrit dans la bibliothèque.
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
await page.locator('.cz-fichebar .cz-back').click(); // fermer la fiche (F5.4 : ‹, plus de ✕)
await page.locator('.cz-librow', { hasText: 'Soupe du smoke' }).waitFor({ timeout: 5000 });
console.log('« L’écrire » : recette créée (Validé), dans la bibliothèque ✅');

// 3ter) T4 — radial → « L'écrire » (formulaire DIRECT, pas d'écran de choix) +
// RECETTE LÉGÈRE (Q2, ruling PO) : « Yaourt », NOM SEUL, zéro ingrédient →
// enregistrée comme vraie recette ET posée dans le créneau (geste fini).
await page.getByRole('tab', { name: 'Menu' }).click();
if (!(await page.locator('.cz-weekbtn.on').count())) await page.locator('.cz-weekbtn').click(); // toggle → idempotent
const mardi = page.locator('.cz-daycard', { hasText: 'Mardi' });
await mardi.locator('.cz-mrow.empty').first().click();
await page.locator('.cz-radial.show').waitFor({ timeout: 5000 });
await page.locator('.cz-petal', { hasText: 'L’écrire' }).click();
await page.getByText('Portions', { exact: true }).waitFor({ timeout: 5000 }); // formulaire direct
if (await page.getByText('Comment on l’ajoute ?').count())
  throw new Error('T4 : le pétale « L’écrire » doit ouvrir le formulaire DIRECTEMENT');
await page.locator('.cz-sheet.show').last().locator('.cz-inp').first().fill('Yaourt');
// ZÉRO ingrédient — c'est la porte Q2 : le bouton doit être actif quand même.
await page.locator('.cz-sheet.show').last().getByText('Enregistrer', { exact: true }).click();
await page.getByText('Recette créée et ajoutée au repas').waitFor({ timeout: 5000 });
await page.waitForTimeout(400);
await mardi.getByText('Yaourt').waitFor({ timeout: 5000 });
console.log('T4/Q2 : recette LÉGÈRE (nom seul) créée via le radial, posée dans le créneau ✅');
// Amendement ② toujours vivant DANS le sélecteur : dépli des 3 voies EN PLACE.
await mardi.locator('.cz-mrow.empty').first().click(); // Déj de mardi (vide)
await page.locator('.cz-radial.show').waitFor({ timeout: 5000 });
await page.locator('.cz-petal', { hasText: 'Ma bibliothèque' }).click();
await page.locator('.cz-sheet.show').last().getByText('Nouvelle recette').click();
await page.locator('.cz-way', { hasText: 'L’écrire' }).waitFor({ timeout: 3000 }); // 3 voies EN PLACE
if (await page.getByText('Comment on l’ajoute ?').count())
  throw new Error('T4 : les 3 voies se déplient EN PLACE, pas une 2ᵉ feuille de choix');
await page.locator('.cz-way', { hasText: 'L’écrire' }).click();
await page.getByText('Portions', { exact: true }).waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show').last().locator('.cz-inp').first().fill('Œufs du picker');
await page.locator('.cz-sheet.show').last().locator('textarea').first().fill('œufs 2\nune noisette de beurre');
await page.locator('.cz-sheet.show').last().getByText('Enregistrer', { exact: true }).click();
await page.getByText('Recette créée et ajoutée au repas').waitFor({ timeout: 5000 });
await page.waitForTimeout(400);
await mardi.getByText('Œufs du picker').waitFor({ timeout: 5000 });
console.log('Amendement ② (T4) : 3 voies dépliées en place, créée et posée ✅');

// 3quater) T5/F5.5 — alerte ALLERGÈNE bout-en-bout SANS backend : les règles du
// foyer (« arachide », posées en 2bis) doivent ressortir sur la page cuisinière
// via « Voir l'aperçu » (previewEspace = même buildEspaceMenu que la publication).
const merc = page.locator('.cz-daycard', { hasText: 'Mercredi' });
await merc.locator('.cz-mrow.empty').nth(1).click(); // Déjeuner (plat)
await page.locator('.cz-radial.show').waitFor({ timeout: 5000 });
await page.locator('.cz-petal', { hasText: 'L’écrire' }).click();
await page.getByText('Portions', { exact: true }).waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show').last().locator('.cz-inp').first().fill('Poulet sauce arachide');
await page.locator('.cz-sheet.show').last().locator('textarea').first().fill('pâte d’arachide 50 g\npoulet 200 g');
await page.locator('.cz-sheet.show').last().getByText('Enregistrer', { exact: true }).click();
await page.getByText('Recette créée et ajoutée au repas').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-x').first().click().catch(() => {});
await page.waitForTimeout(400);
// destinataire (palier 1 : « Ajouter une personne » → formulaire → Enregistrer)
await page.getByLabel('Partager le menu').click();
await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
await page.waitForTimeout(400);
const shareSheet = page.locator('.cz-sheet.show').last();
const addDest = shareSheet.getByText('Ajouter une personne', { exact: false }).first();
if (await addDest.count()) { await addDest.click(); await page.waitForTimeout(400); }
if (await shareSheet.locator('input').count()) {
  await shareSheet.locator('input').first().fill('Fatima');
  await shareSheet.getByText('Enregistrer', { exact: false }).first().click();
  await page.waitForTimeout(600);
}
await shareSheet.getByText('Aperçu · QR', { exact: false }).click();
await page.locator('.cz-preview-overlay').waitFor({ timeout: 8000 });
// La destinataire naît en darija → l'alerte s'affiche d'abord en ARABE (RTL),
// puis on bascule FR : les DEUX registres du gate sont ainsi couverts.
await page.locator('.ck-warn', { hasText: 'arachide' }).first().waitFor({ timeout: 5000 });
await page.locator('.cz-preview-overlay').getByText('FR', { exact: true }).click();
await page.getByText('Attention — contient : arachide').first().waitFor({ timeout: 5000 });
// T4/Q2 (critère de fini) : la recette LÉGÈRE arrive sur la page reçue.
await page.locator('.cz-preview-overlay').getByText('Yaourt').first().waitFor({ timeout: 5000 });
console.log('T4/Q2 : le yaourt (nom seul) est sur la page cuisinière ✅');
await page.screenshot({ path: 'scripts/shot-espace-alerte.png', fullPage: false });
await page.locator('.cz-preview-bar .cz-x').click(); // fermer l'aperçu
await page.waitForTimeout(300);
await page.locator('.cz-overlay.show').first().click({ position: { x: 8, y: 8 } }).catch(() => {});
await page.waitForTimeout(300);
console.log('F5.5 : alerte allergène du foyer visible sur la page cuisinière (aperçu) ✅');

// 4) FC7 — ouvrir une fiche.
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-librow').first().click();
await page.getByText('Ingrédients', { exact: false }).first().waitFor({ timeout: 5000 });
// T5 (F5.1/F5.4) — porte fiche : titre Fraunces + tags + zone photo + Partager dominant.
await page.locator('.cz-fichetitle').waitFor({ timeout: 3000 });
await page.getByText('Ajouter une photo du plat').waitFor({ timeout: 3000 });
await page.locator('.cz-sharebtn').waitFor({ timeout: 3000 });

// 4bis) T6/F6.1 (D1) — Partager depuis la fiche = AJOUT AU MENU puis partage :
// « Pour quel repas ? » avec le défaut en tête (un tap), puis la feuille d'envoi
// s'ouvre — jamais de second canal.
await page.locator('.cz-sharebtn').click();
await page.getByText('Pour quel repas ?').waitFor({ timeout: 5000 });
await page.getByText('Prochain repas', { exact: true }).waitFor({ timeout: 3000 }); // défaut marqué
await page.locator('.cz-sheet.show', { hasText: 'Pour quel repas ?' }).locator('.cz-pick').first().click(); // UN tap
await page.getByText('Ajoutée au repas — à toi d’envoyer').waitFor({ timeout: 5000 });
await page.getByText('L’essentiel dans WhatsApp', { exact: false }).waitFor({ timeout: 5000 }); // partage ouvert
await page.locator('.cz-overlay.show').first().click({ position: { x: 8, y: 8 } }).catch(() => {});
await page.waitForTimeout(400);
console.log('F6.1 (D1) : Partager = posée au prochain repas, puis feuille d’envoi ✅');
await page.getByRole('tab', { name: 'Recettes' }).click();

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
