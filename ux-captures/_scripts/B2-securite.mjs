// B2 — Sécurité en profondeur (verdict PO : « legacy à repenser »).
// États : vide · après import · fiche ouverte. + 2-3 « bento » (Maison/Cuisine) pour
// matérialiser le décalage de langage visuel (Sécurité n'a pas la refonte mz-/bento).
import { open, Film, bypassFtue } from './lib.mjs';

const dir = 'ux-captures/B-lieux/B2-securite';
const { browser, page } = await open();
const f = new Film(dir);

await bypassFtue(page, { roles: ['cuisine', 'nounou'] });

// Ouvrir Sécurité (« La maison » sur le hub)
const sec = page.getByText(/Sécurité|La maison/i).first();
await sec.click(); f.tap();
await page.waitForTimeout(600);
await f.shot(page, 'securite-vide', { screen: 'Sécurité/vide', note: 'ÉTAT VIDE : « Aucune fiche » + « Importer le pack » — style LEGACY (pas mz-/bento)' });

// Importer le pack
const imp = page.getByText('Importer le pack', { exact: false }).first();
if (await imp.count()) {
  await imp.click(); f.tap();
  await page.waitForTimeout(600);
  await f.shot(page, 'securite-apres-import', { screen: 'Sécurité/rempli', note: '4 fiches en statut Test, groupées par type' });
  // ouvrir une fiche
  const fiche = page.locator('.lib-item__edit').first();
  if (await fiche.count()) {
    await fiche.click(); f.tap();
    await page.waitForTimeout(500);
    await f.shot(page, 'securite-fiche', { screen: 'Sécurité/fiche', note: 'édition fiche : FR + darija, statut, vocal' });
  }
}
await browser.close();

// ── Décalage de langage visuel : bento (Maison + Cuisine) vs Sécurité ─────────
const s2 = await open();
const p2 = s2.page;
await bypassFtue(p2, { roles: ['cuisine', 'nounou'] });
await f.shot(p2, 'bento-maison', { screen: 'Maison (bento)', note: 'langage mz-/bento — référence visuelle' });
await p2.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
await p2.getByText('Générer la semaine').waitFor({ timeout: 8000 });
await f.shot(p2, 'bento-cuisine', { screen: 'Cuisine (bento)', note: 'langage cz-/bento — référence visuelle' });
await s2.browser.close();

f.writeMetrics('B2 — Sécurité', `## Constat
Sécurité utilise un langage visuel LEGACY (\`lib-item\`, \`card\`, \`btn--ghost\`, \`empty-note\`) —
distinct du système \`mz-\`/\`cz-\` (bento) de Maison/Cuisine/Nounou. États : vide (« Aucune fiche »
+ import) · rempli (fiches en statut Test à relire/valider) · fiche (FR + darija). Les captures
\`bento-maison\`/\`bento-cuisine\` sont mises côte à côte pour matérialiser le décalage. Parking PO
confirmé : « legacy à repenser » — chantier passe 2 (esthétique) autant que passe 1 (flux
d'import + assignation).`);

console.log(`B2 : ${f.n} états →`, dir);
