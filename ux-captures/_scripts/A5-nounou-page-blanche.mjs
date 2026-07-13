// A5 — Nounou depuis la page blanche (friction PO : « intimidant, vraie complexité de page
// blanche »). Foyer neuf → tout ce qu'il faut pour une journée type transmise.
// Capture les états vides EXACTS vus par un nouveau parent (post-F1 : plus de Yasmine/Adam).
import { open, Film, bypassFtue } from './lib.mjs';

const dir = 'ux-captures/A-flux/A5-nounou-page-blanche';
const { browser, page } = await open();
const f = new Film(dir);

// Foyer neuf : bypass FTUE SANS rien peupler (rôles activés pour voir la carte, doc nounou vide).
await bypassFtue(page, { roles: ['cuisine', 'nounou'] });
await page.locator('.mz-prow', { hasText: 'Nounou' }).first().click(); f.tap();
await page.waitForTimeout(600);

// État vide de la vue Journée (le 1er écran d'un nouveau parent)
await f.shot(page, 'journee-vide', { screen: 'Nounou/journée', note: 'ÉTAT VIDE réel : « Rien de prévu », pas d\'enfant seedé' });

// Ajouter un moment (avec le raccourci « + ajouter un enfant » de F4-bis)
const addBtn = page.locator('.nz-add1, .nz-add2').first();
if (await addBtn.count()) {
  await addBtn.click(); f.tap();
  await page.waitForTimeout(400);
  // Sélecteur « Ajouter » (moment/ponctuel) ?
  const choose = page.getByText('Ajouter un moment', { exact: false }).first();
  if (await choose.count()) { await choose.click(); f.tap(); await page.waitForTimeout(300); }
  await f.shot(page, 'moment-vide', { screen: 'Nounou/moment', note: 'formulaire moment : suggestions + sur-mesure ; « Enfant(s) — optionnel »' });
  // le raccourci ajouter un enfant
  const addKid = page.getByText('Ajouter un enfant', { exact: false }).first();
  if (await addKid.count()) {
    await addKid.click(); f.tap();
    await page.waitForTimeout(300);
    const kidInput = page.locator('.cz-sheet.show input[placeholder="Prénom"], .cz-sheet.show input').last();
    await kidInput.fill('Yasmine'); f.decision();
    await f.shot(page, 'ajout-enfant-inline', { screen: 'Nounou/moment', note: 'raccourci F4-bis : créer l\'enfant sans quitter' });
  }
}

// Conduites vides → import des gabarits
await browser.close();
const s2 = await open();
const page2 = s2.page;
await bypassFtue(page2, { roles: ['cuisine', 'nounou'] });
await page2.locator('.mz-prow', { hasText: 'Nounou' }).first().click();
await page2.waitForTimeout(500);
const tabC = page2.getByText('Conduites', { exact: false }).first();
if (await tabC.count()) {
  await tabC.click(); f.tap();
  await page2.waitForTimeout(400);
  await f.shot(page2, 'conduites-vide', { screen: 'Nounou/conduites', note: 'ÉTAT VIDE : « Aucune conduite » + bouton import gabarits' });
  const imp = page2.getByText('Importer les gabarits', { exact: false }).first();
  if (await imp.count()) {
    await imp.click(); f.tap();
    await page2.waitForTimeout(400);
    await f.shot(page2, 'conduites-apres-import', { screen: 'Nounou/conduites', note: '6 gabarits « à compléter » posés' });
  }
}
// Fiche urgence vide
const tabU = page2.getByText('Urgence', { exact: false }).first();
if (await tabU.count()) {
  await tabU.click(); f.tap();
  await page2.waitForTimeout(400);
  await f.shot(page2, 'urgence-vide', { screen: 'Nounou/urgence', note: 'ÉTAT VIDE : numéros Maroc « à vérifier », « Ajoute un enfant… »' });
}
await s2.browser.close();

f.writeMetrics('A5 — Nounou depuis la page blanche', `## Les états vides EXACTS d'un nouveau parent (post-F1)
Journée « Rien de prévu » · Conduites « Aucune conduite » (+ import gabarits) · Urgence (numéros
Maroc pré-remplis « à vérifier », reste vide). Pour arriver à une journée transmise, un nouveau
parent doit, DEPUIS RIEN : créer ≥1 enfant (ou l'ignorer), ≥1 moment, importer les gabarits,
compléter l'urgence, nommer un destinataire — puis partager. C'est le parcours le plus lourd du
produit. Candidat doctrine : un « démarrage guidé Nounou » (1 enfant + rythme type en 1 tap) au
lieu de N formulaires vides.`);

console.log(`A5 : ${f.n} états →`, dir);
