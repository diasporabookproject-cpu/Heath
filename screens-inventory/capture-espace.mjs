import { execSync } from 'node:child_process';
const root = execSync('npm root -g').toString().trim();
const { chromium } = await import(`${root}/playwright/index.mjs`);
const OUT = process.env.OUT_DIR;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR' });
const p = await ctx.newPage();
await p.goto('http://localhost:4173/#e=demo-token-inexistant', { waitUntil: 'domcontentloaded' });
try { await p.getByText(/vide|plus disponible|indisponible/i).waitFor({ timeout: 15000 }); }
catch {}
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/50-espace-destinataire-vide.png` });
console.log('TEXT:', (await p.evaluate(() => document.body.innerText)).replace(/\n+/g,' | '));
await b.close();
