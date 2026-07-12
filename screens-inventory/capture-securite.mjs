import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
async function loadChromium() {
  try { return (await import('playwright')).chromium; }
  catch { const root = execSync('npm root -g').toString().trim(); return (await import(`${root}/playwright/index.mjs`)).chromium; }
}
const chromium = await loadChromium();
const BASE = 'http://localhost:4173';
const OUT = process.env.OUT_DIR;
const LEGEND = `${OUT}/legende.txt`;
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR' });
const page = await ctx.newPage();

async function snapText() {
  return await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').trim());
}
async function shot(file, role, acces) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}` });
  appendFileSync(LEGEND, `### ${file}\nRôle   : ${role}\nAccès  : ${acces}\nTexte visible :\n${await snapText()}\n${'-'.repeat(72)}\n\n`);
  console.log('✔', file);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByText('Ton équipe').first().waitFor({ timeout: 15000 });
await page.locator('.mz-prow', { hasText: 'La maison' }).first().click();
await page.locator('span', { hasText: 'Sécurité du foyer' }).first().waitFor({ timeout: 8000 });
await page.getByText('Référentiel des consignes').waitFor({ timeout: 8000 });
await page.waitForTimeout(500);
await shot('40-securite-vide.png', 'La maison / Sécurité — référentiel (état initial, avant import)', 'Hub → carte « La maison »');

await page.getByRole('button', { name: /Importer le pack de démarrage/i }).click({ timeout: 5000 });
await page.waitForTimeout(1000);
await page.locator('.lib-item').first().waitFor({ timeout: 8000 });
await shot('41-securite-rempli.png', 'La maison / Sécurité — référentiel rempli (fiches par section, statuts Validé/Test)', 'La maison → « ⇪ Importer le pack de démarrage »');

await browser.close();
console.log('done');
