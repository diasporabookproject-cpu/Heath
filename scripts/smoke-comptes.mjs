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
        tx.objectStore('meta').put(true, 'ftueDone'); // T3 : ftueDone saute AUSSI l'écran 2 (le foyer)
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
const accBtn = page.getByLabel('Compte').first();
await accBtn.waitFor({ timeout: 10000 });
console.log('Page Cuisine ouverte, accès compte présent ✅');

// 3) T4 : la PAGE de compte s'ouvre — SANS session vivante. Elle doit nommer
//    l'occupant depuis l'appareil (`compteLie`), offrir la sortie, et ne jamais
//    proposer d'« étape e-mail » : derrière le mur (T1) il n'y a plus d'état
//    « déconnecté » à porter, seulement « compte lié, réseau absent ».
await accBtn.click();
await page.locator('.cp .idrow .it b', { hasText: 'smoke@exemple.com' }).waitFor({ timeout: 5000 });
await page.locator('.cp .logout').waitFor({ timeout: 3000 });
if (await page.getByText('sans compte', { exact: false }).count())
  throw new Error('T1 : l’échappatoire « je continue sans compte » doit avoir disparu');
// Le foyer est illisible hors-ligne → l'invitation est proposée MAIS inerte, et le
// dit (« Disponible dès le retour du réseau ») plutôt que d'échouer en silence.
if (!(await page.locator('.cp .genrow:disabled').count()))
  throw new Error('T4 : « Inviter quelqu’un » doit être inerte sans session');
// La pastille porte l'initiale de l'e-mail du compte lié (pas d'état de connexion).
if ((await page.locator('.cp .idrow .av').innerText()) !== 'S')
  throw new Error('T4 : la pastille d’identité doit porter l’initiale du compte');
await page.screenshot({ path: 'scripts/shot-compte-page.png' });
console.log('T4 : page de compte hors-ligne — occupant nommé, sortie offerte, invitation inerte ✅');

// 3bis) 🔴 Retour device : un appareil DÉJÀ installé n'a jamais vu l'écran 2, son
//        prénom n'a donc jamais été demandé — et rien ne permettait de le poser
//        après (« Sans prénom » à jamais). Sa propre ligne se modifie, et ça marche
//        HORS-LIGNE (la copie locale s'écrit d'abord ; le foyer suivra au réseau).
if (!(await page.locator('.cp .mrow.me').count()))
  throw new Error('Retour device : la ligne « (vous) » doit être modifiable');
await page.locator('.cp .mrow.me').click();
await page.locator('.cp .cpsheet h2', { hasText: 'Votre prénom' }).waitFor({ timeout: 3000 });
await page.locator('.cp .pinp').fill('Amine');
await page.locator('.cp .pbtn').click();
await page.locator('.cp .mrow.me .mn', { hasText: 'Amine' }).waitFor({ timeout: 5000 });
if ((await page.locator('.cp .idrow .av').innerText()) !== 'A')
  throw new Error('Retour device : la pastille doit suivre le prénom, pas l’e-mail');
await page.screenshot({ path: 'scripts/shot-compte-prenom.png' });
console.log('Retour device ③ : prénom posable depuis la page de compte, hors-ligne ✅');

// 3ter) T4 : « Avancé » porte l'export ENTERRÉ et le replay de l'introduction.
await page.locator('.cp .footlinks .fl', { hasText: 'Avancé' }).click();
await page.getByText('Exporter mes données').waitFor({ timeout: 3000 });
await page.getByText('Revoir l’introduction').waitFor({ timeout: 3000 });
await page.screenshot({ path: 'scripts/shot-compte-avance.png' });
await page.locator('.cp .hd .bk').click();
console.log('T4 : Avancé — export enterré + revoir l’introduction ✅');

// 3quater) T4 : la suppression NE BRANDIT PAS de conséquences qu'elle ne connaît pas.
//        Foyer illisible (hors-ligne) → variante « inconnu » : aucun bloc rouge.
await page.locator('.cp .footlinks .fl.dgr').click();
await page.getByText('Supprimer votre compte ?').waitFor({ timeout: 3000 });
if (await page.locator('.cp .impact').count())
  throw new Error('T4 : aucune conséquence ne doit être affirmée quand le foyer est illisible');
await page.locator('.cp .cbtn').click();
console.log('T4 : suppression — aucune conséquence inventée hors-ligne ✅');

// 4) Fermeture propre → retour à l'app utilisable (la page a son chevron de retour).
await page.locator('.cp .hd .bk').click();
await page.getByLabel('Compte').first().waitFor({ timeout: 5000 });
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
await page.getByText('Connectez-vous pour retirer Testouya', { exact: false }).waitFor({ timeout: 5000 });
if (await page.getByText('ne donne plus rien', { exact: false }).count()) {
  throw new Error('PORTE F1 : le toast de succès est apparu sans session (faux succès)');
}
await page.getByText('Testouya').first().waitFor({ timeout: 5000 }); // conservée dans la liste
console.log('Revoke honnête déconnecté : refus franc, personne conservée ✅');

console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page ✅');
await browser.close();
if (errors.length) process.exit(1);
