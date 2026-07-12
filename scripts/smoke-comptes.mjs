// Smoke « Compte — parcours DÉCONNECTÉ ». Garantit l'invariant produit
// « l'app est 100 % utilisable sans compte » : chargement, hub Maison, navigation
// vers une page de rôle, ouverture de la feuille Compte en état déconnecté (l'accès
// est proposé, jamais imposé). AUCUNE imitation d'auth.
//
// ⚠️ CE QUE CE SMOKE NE PROUVE PAS : le rendu de l'espace CONNECTÉ, la sync réelle,
// la RLS. Le vrai smoke authentifié (session réelle contre staging) est au backlog,
// relié à F2 (le compte par mot de passe contournera l'OTP). Voir DEVLOG.
//
// Prérequis : `npm run build` (base /Heath/) puis `npm run preview` en base /Heath/.
// Env : BASE_URL (défaut http://localhost:4173/Heath/).
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

const BASE = process.env.BASE_URL || 'http://localhost:4173/Heath/';
const IGNORE = /Failed to load resource|net::ERR_|fonts\.googleapis|gstatic|supabase\.co/i;

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('pageerror: ' + e.message); });

await page.goto(BASE, { waitUntil: 'networkidle' });

// F4 (Flow FTUE) : court-circuit PROPRE du gate — méta posées puis reload
// (même préambule que smoke.mjs ; la FTUE a son smoke dédié : smoke-ftue.mjs).
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

// 1) L'app démarre SANS compte : le hub Maison s'affiche.
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
console.log('Hub Maison (sans compte) ✅');

// 2) Navigation vers une page de rôle (Cuisine) — le contenu est accessible hors-ligne.
await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
const accBtn = page.getByLabel('Compte et synchro').first();
await accBtn.waitFor({ timeout: 10000 });
console.log('Page Cuisine ouverte, accès compte présent ✅');

// 3) La feuille Compte s'ouvre en état DÉCONNECTÉ (étape e-mail) et propose la
//    connexion SANS l'imposer (« je continue sans compte » = l'invariant matérialisé).
//    C'est le contenu de la feuille — pas l'icône du bouton — qui atteste l'état.
await accBtn.click();
await page.getByText("Mets ta maison à l'abri").waitFor({ timeout: 5000 });
await page.getByText('je continue sans compte', { exact: false }).waitFor({ timeout: 5000 });
console.log('Feuille Compte déconnectée : connexion proposée, jamais imposée ✅');

// 4) Fermeture propre (on continue sans compte) → retour à l'app utilisable.
await page.getByText('je continue sans compte', { exact: false }).click();
await page.getByLabel('Compte et synchro').first().waitFor({ timeout: 5000 });
console.log('Retour à l’app sans compte ✅');

console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');
await browser.close();
if (errors.length) process.exit(1);
