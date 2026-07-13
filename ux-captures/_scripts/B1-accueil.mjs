// B1 — L'accueil (hub Maison) en profondeur (verdict PO : « ne fonctionne pas »).
// Tous les états + un export innerText de ce que l'écran affiche réellement.
import { open, Film, bypassFtue, installCollection } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const dir = 'ux-captures/B-lieux/B1-accueil';
const { browser, page } = await open();
const f = new Film(dir);

// État 1 : foyer neuf post-FTUE (rôles activés, rien peuplé, déconnecté)
await bypassFtue(page, { roles: ['cuisine', 'nounou'] });
await f.shot(page, 'foyer-neuf-cartes-role', { screen: 'Hub/neuf', note: 'cartes de rôle vides, déconnecté' });
const txtNeuf = await page.locator('.app, .mz, body').first().innerText();

// État 2 : foyer rempli (collection + un repas + rythme) — via installations
await installCollection(page);
await page.getByRole('tab', { name: 'Semaine' }).click();
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click();
await page.locator('.cz-sheet.show .cz-pick').first().click();
await page.waitForTimeout(300);
await page.locator('.cz-sheet.show .cz-x').first().click();
await page.locator('.cz-back, [aria-label*="Retour"]').first().click();
await page.getByText('Ton équipe').waitFor({ timeout: 8000 });
await f.shot(page, 'foyer-rempli', { screen: 'Hub/rempli', note: 'avec menu du jour, prochain événement' });
const txtRempli = await page.locator('.app, .mz, body').first().innerText();

writeFileSync(`${dir}/INNERTEXT.md`, `# B1 — hub Maison : inventaire de ce que l'écran AFFICHE (innerText réel)

## État « foyer neuf » (post-FTUE, déconnecté)
\`\`\`
${txtNeuf.trim()}
\`\`\`

## État « foyer rempli » (collection + 1 repas)
\`\`\`
${txtRempli.trim()}
\`\`\`
`);

f.writeMetrics('B1 — Accueil (hub Maison)', `## États capturés
Foyer neuf (cartes de rôle vides, déconnecté) · foyer rempli (menu du jour, prochain événement).
Le innerText réel est exporté dans \`INNERTEXT.md\` — matière pour juger « ce que le hub dit vraiment »
contre le verdict PO « ne fonctionne pas » (hiérarchie ? action principale ? bruit ?).`);

console.log(`B1 : ${f.n} états →`, dir);
await browser.close();
