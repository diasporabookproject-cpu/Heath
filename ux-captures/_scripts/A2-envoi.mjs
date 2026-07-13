// A2 — L'envoi/paramétrage de partage (friction PO : « trop de menus, options, choix »).
// Matérialise TOUTES les décisions demandées dans la feuille de partage, Cuisine ET Nounou.
import { open, BASE, Film, bypassFtue, installCollection, createCuisineDest } from './lib.mjs';

const dir = 'ux-captures/A-flux/A2-envoi';
const { browser, page } = await open();
const f = new Film(dir);

await bypassFtue(page);
await installCollection(page);

// Composer un repas pour que « La semaine » ait du contenu (digest non vide).
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await page.getByRole('tab', { name: 'Semaine' }).click();
await lundi.locator('.cz-mrow.empty').first().click();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click();
await page.locator('.cz-sheet.show .cz-pick').first().click();
await page.waitForTimeout(300);
await page.locator('.cz-sheet.show .cz-x').first().click();
await lundi.locator('.cz-mrow:not(.empty)').first().waitFor({ timeout: 5000 });

// ── Feuille de partage CUISINE : chaque option ────────────────────────────────
// Constat capturé d'abord : SANS destinataire, le partage s'ouvre sur « Nouvelle personne ».
await page.getByLabel('Partager le menu').click(); f.tap();
await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
await page.waitForTimeout(400);
await f.shot(page, 'cuisine-nouvelle-personne', { screen: 'Cuisine/partage', note: 'FRICTION : sans destinataire, il faut d\'abord CRÉER une personne (nom, rôle, langue, tél)' });
await page.locator('.cz-sheet.show input').first().fill('Fatima'); f.decision();
await page.locator('.cz-sheet.show .cz-cta').last().click(); f.tap();
await page.waitForTimeout(500);
await f.shot(page, 'cuisine-partage-complet', { screen: 'Cuisine/partage', note: 'vue envoi entière : destinataire, QUOI ENVOYER, message, rappel, aperçu' });

// QUOI ENVOYER : 4 portées (La semaine / Aujourd'hui / Demain / Un jour…)
const scopes = ['Aujourd’hui', 'Demain', 'Un jour'];
for (const s of scopes) {
  const chip = page.locator('.cz-sheet.show').getByText(s, { exact: false }).first();
  if (await chip.count()) { await chip.click(); f.tap().decision(); await page.waitForTimeout(300); }
}
await f.shot(page, 'cuisine-portee-unjour', { screen: 'Cuisine/partage', note: '« Un jour… » → sélecteur de jour apparaît' });
// Rappel d'envoi
const rappel = page.locator('.cz-sheet.show').getByText('Activer', { exact: false }).first();
if (await rappel.count()) { await rappel.click(); f.tap().decision(); await page.waitForTimeout(300);
  await f.shot(page, 'cuisine-rappel', { screen: 'Cuisine/rappel', note: 'planifier un rappel WhatsApp' }); }
// Aperçu
const apercu = page.locator('.cz-sheet.show').getByText('Aperçu', { exact: false }).first();
if (await apercu.count()) { await apercu.click(); f.tap(); await page.waitForTimeout(500);
  await f.shot(page, 'cuisine-apercu', { screen: 'Cuisine/aperçu', note: 'la page telle que reçue' }); }

await browser.close();

// ── Feuille de partage NOUNOU : recompter les options ─────────────────────────
const s2 = await open();
const page2 = s2.page;
await bypassFtue(page2);
// installer les gabarits pour que la page nounou ait du contenu à envoyer
await page2.locator('.mz-prow', { hasText: 'Nounou' }).first().click();
await page2.waitForTimeout(500);
// ouvrir le partage nounou (bouton IconShareUp de l'en-tête nounou)
const shareN = page2.getByLabel(/Partager/i).first();
if (await shareN.count()) {
  await shareN.click(); f.tap();
  await page2.waitForTimeout(600);
  await f.shot(page2, 'nounou-partage-complet', { screen: 'Nounou/partage', note: 'destinataire, langue, message, traduction, QR, rappel' });
  // langue (chips) / traduction / QR
  for (const label of ['Traduire', 'QR', 'Aperçu']) {
    const b = page2.getByText(label, { exact: false }).first();
    if (await b.count()) { f.decision(); }
  }
} else {
  f.log.push({ file: '(aucun)', screen: 'Nounou/partage', note: 'bouton partage non atteint sans destinataire nommé — voir RECAP' });
}
await s2.browser.close();

f.writeMetrics('A2 — Envoi / paramétrage de partage', `## Décisions matérialisées (à passer aux 5 questions)
**Cuisine** : destinataire (Changer) · QUOI ENVOYER = 4 portées (La semaine / Aujourd'hui /
Demain / Un jour…) · message éditable · rappel d'envoi (activer + jour + heure) · aperçu.
**Nounou** : destinataire · langue · message éditable + traduction (sensible à relire) · QR ·
rappel. Doctrine : « La semaine » est déjà le défaut ; les 3 autres portées + rappel + traduction
sont du **rang 2** candidat au repli sous un « Options ».`);

console.log(`A2 : ${f.n} états →`, dir);
