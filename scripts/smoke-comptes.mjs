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

// F4 + T1 : court-circuit PROPRE du gate — méta posées puis reload (même préambule
// que smoke.mjs). T1 : `compteLie` est posé SANS session Supabase vivante — c'est
// exactement l'état « compte lié, réseau/jeton absent », le cas que ce smoke protège.
await page.getByText('Bienvenue', { exact: false }).waitFor({ timeout: 10000 });
await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('menu-semaine');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({ userId: 'smoke', email: 'smoke@exemple.com', at: Date.now() }, 'compteLie');
        tx.objectStore('meta').put(true, 'ftueDone');
        tx.objectStore('meta').put(['cuisine', 'nounou'], 'rolesActifs');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    }),
);
await page.reload({ waitUntil: 'networkidle' });

// 1) T1 : compte LIÉ mais session absente → l'app s'ouvre quand même (le gate porte
//    le drapeau local, pas la session vivante). C'est le cas du métro.
await page.getByText('Votre foyer').waitFor({ timeout: 10000 });
console.log('Hub Maison (compte lié, session absente) ✅');

// 2) Navigation vers une page de rôle (Cuisine) — le contenu est accessible hors-ligne.
await page.locator('.b1-cuihero').click();
const accBtn = page.getByLabel('Compte et synchro').first();
await accBtn.waitFor({ timeout: 10000 });
console.log('Page Cuisine ouverte, accès compte présent ✅');

// 3) La feuille Compte s'ouvre sur l'étape e-mail (aucune session vivante) — mais
//    T1 : l'échappatoire « je continue sans compte » N'EXISTE PLUS.
//    (La refonte de cette feuille en page de compte propre est la tranche T4.)
await accBtn.click();
await page.getByText("Mets ta maison à l'abri").waitFor({ timeout: 5000 });
if (await page.getByText('sans compte', { exact: false }).count())
  throw new Error('T1 : l’échappatoire « je continue sans compte » doit avoir disparu');
console.log('Feuille Compte : plus aucune échappatoire « sans compte » ✅');

// 4) Fermeture propre → retour à l'app utilisable. La feuille se ferme par son
//    voile (primitives.tsx:198 : clic SUR l'overlay, hors du panneau).
await page.locator('.mz-ovl.on').click({ position: { x: 6, y: 6 } });
await page.getByLabel('Compte et synchro').first().waitFor({ timeout: 5000 });
console.log('Retour à l’app ✅');

// 5) PORTE F1 (mini-lot destinataires) — le revoke HONNÊTE, déconnecté :
//    sans session, « Révoquer » doit REFUSER franchement (la policy delete
//    d'`espaces` est `to authenticated` — un DELETE anonyme répondrait 200 avec
//    0 ligne SANS erreur : c'était le faux succès). La personne est CONSERVÉE.
await page.getByLabel('Partager le menu').first().click();
await page.getByText('Nouvelle personne').waitFor({ timeout: 5000 }); // 0 destinataire → mode édition
await page.locator('.cz-inp').first().fill('Testouya');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Partager avec Testouya').waitFor({ timeout: 5000 }); // titre feuille v2 (T1 lot partage)
await page.getByRole('button', { name: 'Changer' }).click();
await page.getByRole('button', { name: 'Révoquer' }).click();
await page.getByText('Connecte-toi pour retirer Testouya', { exact: false }).waitFor({ timeout: 5000 });
if (await page.getByText('ne donne plus rien', { exact: false }).count()) {
  throw new Error('PORTE F1 : le toast de succès est apparu sans session (faux succès)');
}
await page.getByText('Testouya').first().waitFor({ timeout: 5000 }); // conservée dans la liste
console.log('Revoke honnête déconnecté : refus franc, personne conservée ✅');

console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');
await browser.close();
if (errors.length) process.exit(1);
