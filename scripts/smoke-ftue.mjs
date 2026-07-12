// Smoke FTUE (F4, Flow FTUE) — traversée RÉELLE du premier lancement :
// entry → domaines (La cuisine) → mémoire → personnes (Cuisine) → transmission
// → welcome → hub. Vérifie que la FTUE PILOTE le peuplement : collection
// installée (30 recettes), carte de rôle Cuisine posée, Nounou NON posée
// (rien coché → pas de carte), ftueDone posé (reload → plus de FTUE).
// `npm run build && vite preview` d'abord — même harnais que smoke.mjs.
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('pageerror: ' + e.message); });

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1) #entry — le gate montre la FTUE sur stockage vierge (pas le hub).
await page.getByText('Manzil vous aide', { exact: false }).waitFor({ timeout: 10000 });
await page.getByRole('button', { name: 'Rejoindre un foyer existant' }).waitFor({ timeout: 3000 });
console.log('FTUE #entry (gate pré-boot actif) ✅');
await page.screenshot({ path: 'scripts/shot-ftue-entry.png' });
await page.getByRole('button', { name: 'Entrer', exact: true }).click();

// 2) #domain — cocher « La cuisine » ; « L'entretien » est Bientôt (non sélectionnable).
await page.getByText('Par quoi voulez-vous commencer', { exact: false }).waitFor({ timeout: 5000 });
await page.locator('.ftue .opt', { hasText: 'La cuisine' }).click();
const soon = await page.locator('.ftue .opt.soon', { hasText: 'L’entretien' }).count();
if (soon !== 1) throw new Error('Domaine « Bientôt » manquant');
await page.screenshot({ path: 'scripts/shot-ftue-domain.png' });
await page.getByRole('button', { name: 'Continuer' }).click();

// 3) #memory (planche) → #people : poser la carte Cuisine seulement.
await page.getByText('La mémoire de votre maison', { exact: false }).waitFor({ timeout: 5000 });
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByText('Qui vous aide au quotidien', { exact: false }).waitFor({ timeout: 5000 });
await page.locator('.ftue .opt', { hasText: 'Cuisine' }).first().click();
await page.getByRole('button', { name: 'Continuer' }).click();

// 4) #send (planche) → #welcome → Entrer (COMMIT du peuplement).
await page.getByText('La transmission', { exact: false }).waitFor({ timeout: 5000 });
await page.screenshot({ path: 'scripts/shot-ftue-send.png' });
await page.getByRole('button', { name: 'Terminer' }).click();
await page.getByText('Bienvenue', { exact: false }).waitFor({ timeout: 5000 });
await page.getByRole('button', { name: 'Entrer', exact: true }).click();
console.log('Traversée entry → domaines → personnes → welcome ✅');

// 5) Hub : carte Cuisine posée, Nounou NON posée (pas cochée).
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
if ((await page.locator('.mz-prow', { hasText: 'Cuisine' }).count()) === 0) throw new Error('Carte Cuisine absente');
if ((await page.locator('.mz-prow', { hasText: 'Nounou' }).count()) !== 0) throw new Error('Carte Nounou posée à tort');
console.log('Hub : carte Cuisine posée, Nounou non posée ✅');

// 6) Le peuplement a suivi le choix : bibliothèque = 30 recettes de la collection.
await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-librow').first().waitFor({ timeout: 5000 });
const nb = await page.locator('.cz-librow').count();
if (nb !== 30) throw new Error(`Bibliothèque : ${nb} recettes (attendu 30)`);
console.log('Collection installée par la FTUE ✅ (30 recettes)');

// 7) ftueDone posé : un reload NE re-présente PAS la FTUE.
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
if (await page.getByText('Manzil vous aide', { exact: false }).count()) throw new Error('FTUE re-présentée après welcome');
console.log('ftueDone posé — plus de FTUE au reload ✅');

// 8) MIGRATION ONE-SHOT (appareil existant mis à jour → JAMAIS la FTUE) :
// contexte neuf où seule `seedVersion` existe (preuve d'un boot antérieur) →
// le gate pose ftueDone + rôles rétroactivement et va DIRECT au hub.
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page2 = await ctx2.newPage();
await page2.goto(BASE, { waitUntil: 'networkidle' });
await page2.getByText('Manzil vous aide', { exact: false }).waitFor({ timeout: 10000 }); // vierge → FTUE (base créée)
await page2.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('menu-semaine');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put(4, 'seedVersion'); // appareil « existant » simulé
        tx.objectStore('meta').delete('ftueDone');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    }),
);
await page2.reload({ waitUntil: 'networkidle' });
await page2.getByText('Ton équipe').waitFor({ timeout: 10000 });
if (await page2.getByText('Manzil vous aide', { exact: false }).count()) throw new Error('FTUE montrée à un appareil existant');
if ((await page2.locator('.mz-prow', { hasText: 'Nounou' }).count()) === 0) throw new Error('Rôles non activés rétroactivement');
console.log('Migration one-shot : appareil existant → hub direct, rôles rétroactifs ✅');

console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');
await browser.close();
if (errors.length) process.exit(1);
