// Lib de capture UX (chantier « Simplicité & fluidité », passe 1) — LECTURE SEULE
// côté produit : ces scripts pilotent l'app RÉELLE (build prod local + preview) via
// Playwright, ils ne modifient rien dans src/. Harnais repris des smokes
// (chromium global, viewport 390×844 @2x, filtre erreurs, bypass FTUE par IndexedDB).
//
// ⚠️ « jamais la prod » : on NE déclenche AUCUNE auth réelle (OTP = e-mail réel). Les
// captures montrent les états CLIENT ; ce qui exige le backend est listé au RECAP.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return (await import(`${root}/playwright/index.mjs`)).chromium;
  }
}

export const BASE = process.env.BASE_URL || 'http://localhost:4173/Heath/';
const IGNORE = /Failed to load resource|net::ERR_|fonts\.googleapis|gstatic|supabase\.co/i;

/** Ouvre un navigateur + une page instrumentée. Retourne { browser, page, ctx, errors }. */
export async function open() {
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('pageerror: ' + e.message); });
  return { browser, page, ctx, errors };
}

/** Compteur de « métriques UX » d'un flux : écrans distincts, taps, décisions demandées. */
export class Film {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.n = 0;
    this.taps = 0;
    this.decisions = 0; // saisies/choix que l'app EXIGE (champ rempli, option cochée…)
    this.screens = new Set();
    this.log = [];
  }
  /** Capture un état, numéroté dans l'ordre du geste. `screen` = nom logique de l'écran. */
  async shot(page, slug, { screen, note } = {}) {
    this.n += 1;
    const num = String(this.n).padStart(2, '0');
    const file = `${num}-${slug}.png`;
    await page.screenshot({ path: `${this.dir}/${file}` });
    if (screen) this.screens.add(screen);
    this.log.push({ file, screen: screen ?? '', note: note ?? '' });
    return file;
  }
  tap(n = 1) { this.taps += n; return this; }
  decision(n = 1) { this.decisions += n; return this; }
  /** Écrit METRIQUES.md : compteurs + table des états capturés. */
  writeMetrics(titre, extra = '') {
    const rows = this.log.map((l, i) => `| ${String(i + 1).padStart(2, '0')} | ${l.file} | ${l.screen} | ${l.note} |`).join('\n');
    const md = `# ${titre} — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **${this.screens.size}** |
| Taps (gestes) | **${this.taps}** |
| Décisions demandées (saisie/choix exigés) | **${this.decisions}** |
| États capturés | ${this.n} |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
${rows}
${extra ? '\n' + extra + '\n' : ''}`;
    writeFileSync(`${this.dir}/METRIQUES.md`, md);
  }
}

/** Passe le gate FTUE : visite, pose ftueDone + rôles, recharge → hub direct.
 * (Même technique que les smokes : écrire-puis-recharger est déterministe.) */
export async function bypassFtue(page, { roles = ['cuisine', 'nounou'] } = {}) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByText('Manzil vous aide', { exact: false }).waitFor({ timeout: 10000 });
  await page.evaluate(
    (r) =>
      new Promise((res, rej) => {
        const q = indexedDB.open('menu-semaine');
        q.onsuccess = () => {
          const db = q.result;
          const tx = db.transaction('meta', 'readwrite');
          tx.objectStore('meta').put(true, 'ftueDone');
          tx.objectStore('meta').put(r, 'rolesActifs');
          tx.oncomplete = () => { db.close(); res(); };
          tx.onerror = () => rej(tx.error);
        };
        q.onerror = () => rej(q.error);
      }),
    roles,
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
}

/** Installe la collection « Fonds de départ » (30 recettes) via l'UI Collections. */
export async function installCollection(page) {
  await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
  await page.getByRole('tab', { name: 'Recettes' }).click();
  await page.locator('.cz-pkt', { hasText: 'Fonds de départ' }).click();
  await page.locator('.cz-sheet.show .cz-cta').click();
  await page.locator('.cz-librow').first().waitFor({ timeout: 5000 });
}

/** Crée un destinataire Cuisine via le formulaire « Nouvelle personne » (la feuille
 * de partage s'ouvre dessus quand il n'y en a aucun). Laisse la feuille en mode envoi. */
export async function createCuisineDest(page, nom = 'Fatima') {
  await page.getByLabel('Partager le menu').click();
  await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  const sheet = page.locator('.cz-sheet.show');
  // Palier 1 : état vide = « ＋ Ajouter une personne » (avant même le formulaire).
  const addBtn = sheet.getByText('Ajouter une personne', { exact: false }).first();
  if (await addBtn.count()) { await addBtn.click(); await page.waitForTimeout(400); }
  // Palier 2 : formulaire « Nouvelle personne » → remplir nom + « Enregistrer »
  // (⚠️ le formulaire a 2 cz-cta : Enregistrer + Annuler — cibler par texte).
  if (await sheet.locator('input').count()) {
    await sheet.locator('input').first().fill(nom);
    await sheet.getByText('Enregistrer', { exact: false }).first().click();
    await page.waitForTimeout(600);
  }
}

/** Ferme une feuille cz-* en cliquant l'overlay (coin), robuste. */
export async function closeCzSheet(page) {
  await page.locator('.cz-overlay.show, .cz-x').first().click({ position: { x: 8, y: 8 } }).catch(() => {});
  await page.waitForTimeout(300);
}
