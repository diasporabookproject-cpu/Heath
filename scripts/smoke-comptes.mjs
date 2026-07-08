// Smoke « Comptes » — parcours UI de l'espace connecté, SESSION MOCKÉE.
// ⚠️ PÉRIMÈTRE : teste que l'UI connectée s'affiche et ne casse pas (vue compte,
// export/invitation/quitter, feuille d'adoption). Il NE teste PAS la sync réelle
// ni la RLS : la session est un jeton bidon (les appels backend échouent, avalés).
// Le vrai smoke authentifié contre staging est au backlog (relié à F2 : le compte
// par mot de passe contournera l'OTP). Voir DEVLOG.
//
// Prérequis : `npm run build` (avec VITE_SUPABASE_URL/KEY) puis `npm run preview`.
// Env : BASE_URL (défaut http://localhost:4173/Heath/), SB_REF (ref projet Supabase
// pour la clé de storage ; défaut = prod).
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
const REF = process.env.SB_REF || 'pqeilsuqglmrvijndrwa';
// Erreurs attendues avec une session bidon (réseau/auth) — on ne les compte pas.
// Le jeton est bidon → tout appel backend (getUser, sync) échoue et est avalé par
// l'app : ces erreurs réseau/auth ne comptent pas (seul le rendu UI est testé ici).
const IGNORE = /Failed to (load resource|fetch)|net::ERR_|fonts\.googleapis|gstatic|supabase\.co|401|403|Invalid|JWT|refresh|token|AuthApiError|AuthRetryableFetchError/i;

// Session mockée (expiry lointain → pas de refresh réseau immédiat). Stockée en
// JSON brut sous `sb-<ref>-auth-token` — format de persistance de supabase-js.
const far = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64url({ sub: 'smoke', email: 'smoke@manzil.test', role: 'authenticated', exp: far })}.sig`;
const session = {
  access_token: fakeJwt, token_type: 'bearer', expires_in: 31536000, expires_at: far,
  refresh_token: 'smoke-refresh',
  user: { id: 'smoke-user', email: 'smoke@manzil.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
};
const key = `sb-${REF}-auth-token`;

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [key, JSON.stringify(session)]);
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('pageerror: ' + e.message); });

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1) Le hub s'affiche et une page de rôle s'ouvre (topbar avec le bouton compte).
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
const accBtn = page.getByLabel('Compte et synchro').first();
await accBtn.waitFor({ timeout: 10000 });
const label = (await accBtn.innerText()).trim();
if (label !== '☁︎') throw new Error(`Session non reconnue : bouton compte = "${label}" (attendu "☁︎")`);
console.log('Session mockée reconnue (bouton ☁︎) ✅');

// 2) La feuille Compte affiche la vue CONNECTÉE (email + actions clés).
await accBtn.click();
await page.getByText("Ta maison est à l'abri").waitFor({ timeout: 5000 });
await page.getByText('smoke@manzil.test').waitFor({ timeout: 5000 });
for (const t of ['Exporter mes données', 'Inviter quelqu’un dans mon foyer', 'Quitter le foyer partagé', 'Supprimer mon compte']) {
  if (await page.getByText(t, { exact: false }).count() === 0) throw new Error(`Action compte manquante : « ${t} »`);
}
console.log('Vue compte connectée : email + export/invitation/quitter/suppression ✅');

// 3) L'écran de confirmation « Quitter » s'ouvre et mentionne la sauvegarde (filet).
await page.getByText('Quitter le foyer partagé').click();
await page.getByText('une copie de tes données va être téléchargée', { exact: false }).waitFor({ timeout: 3000 });
await page.getByText('Annuler').first().click();
console.log('Confirmation « Quitter » + mention du filet de sauvegarde ✅');

console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur console/page (UI) ✅');
await browser.close();
if (errors.length) process.exit(1);
