// A1 — LE parcours roi : installation → première page envoyée.
// Film de référence du chantier. Joué comme un utilisateur, chaque état capturé.
// ⚠️ « jamais la prod » : on s'arrête à l'apparition du volet « Sécuriser » (l'auth
// OTP réelle enverrait un e-mail via le backend prod) — la suite est documentée au RECAP.
import { open, BASE, Film } from './lib.mjs';

const dir = 'ux-captures/A-flux/A1-premiere-page';
const { browser, page } = await open();
const f = new Film(dir);

await page.goto(BASE, { waitUntil: 'networkidle' });

// 1) FTUE #entry (stockage vierge → gate)
await page.getByText('Manzil vous aide', { exact: false }).waitFor({ timeout: 10000 });
await f.shot(page, 'ftue-entry', { screen: 'FTUE/entry', note: 'première ouverture' });
await page.getByRole('button', { name: 'Entrer', exact: true }).click(); f.tap();

// 2) #domain — cocher La cuisine + Les enfants (2 décisions)
await page.getByText('Par quoi voulez-vous commencer', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'ftue-domaines-vide', { screen: 'FTUE/domain', note: '5 domaines, 2 « Bientôt »' });
await page.locator('.ftue .opt', { hasText: 'La cuisine' }).click(); f.tap().decision();
await page.locator('.ftue .opt', { hasText: 'Les enfants' }).click(); f.tap().decision();
await f.shot(page, 'ftue-domaines-coches', { screen: 'FTUE/domain', note: 'cuisine + enfants cochés' });
await page.getByRole('button', { name: 'Continuer' }).click(); f.tap();

// 3) #memory (planche)
await page.getByText('La mémoire de votre maison', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'ftue-memoire', { screen: 'FTUE/memory', note: 'planche narrative' });
await page.getByRole('button', { name: 'Continuer' }).click(); f.tap();

// 4) #people — nommer la cuisinière (name-sheet = 2 décisions : prénom + langue)
await page.getByText('Qui vous aide au quotidien', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'ftue-personnes', { screen: 'FTUE/people', note: 'rôles à poser' });
await page.locator('.ftue .opt', { hasText: 'Cuisine' }).first().click(); f.tap();
await page.getByText('Comment s’appelle votre cuisinière', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'ftue-namesheet', { screen: 'FTUE/name-sheet', note: 'prénom + langue' });
await page.locator('.ftue .nsheet input').fill('Fatima'); f.decision();
await page.locator('.ftue .nsheet .lchip', { hasText: 'الدارجة' }).click(); f.decision();
await f.shot(page, 'ftue-namesheet-rempli', { screen: 'FTUE/name-sheet', note: 'Fatima · darija' });
await page.locator('.ftue .nsheet .btn').click(); f.tap();
await page.getByText('✓ Fatima', { exact: false }).waitFor({ timeout: 4000 });
await f.shot(page, 'ftue-personnes-nomme', { screen: 'FTUE/people', note: 'carte « ✓ Fatima · darija »' });
await page.getByRole('button', { name: 'Continuer' }).click(); f.tap();

// 5) #send (planche) → #welcome
await page.getByText('La transmission', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'ftue-transmission', { screen: 'FTUE/send', note: 'planche 5 étapes' });
await page.getByRole('button', { name: 'Terminer' }).click(); f.tap();
await page.getByText('Bienvenue', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'ftue-bienvenue', { screen: 'FTUE/welcome' });
await page.getByRole('button', { name: 'Entrer', exact: true }).click(); f.tap();

// 6) Hub post-FTUE (collection installée + Fatima posée)
await page.getByText('Ton équipe').waitFor({ timeout: 10000 });
await f.shot(page, 'hub', { screen: 'Hub Maison', note: 'Fatima · Cuisine + carte Nounou' });

// 7) Composer un minimum : ouvrir Cuisine → un repas
await page.locator('.mz-prow', { hasText: 'Fatima' }).first().click(); f.tap();
await page.getByText('Générer la semaine').waitFor({ timeout: 10000 });
await f.shot(page, 'cuisine-semaine-vide', { screen: 'Cuisine/semaine', note: 'semaine vide' });
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click(); f.tap();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await f.shot(page, 'composeur', { screen: 'Cuisine/composeur', note: 'composer un repas' });
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click(); f.tap().decision();
await page.locator('.cz-sheet.show .cz-pick').first().waitFor({ timeout: 5000 });
await f.shot(page, 'composeur-picker', { screen: 'Cuisine/picker', note: 'choisir le plat' });
await page.locator('.cz-sheet.show .cz-pick').first().click(); f.tap().decision();
await page.waitForTimeout(300);
await page.locator('.cz-sheet.show .cz-x').first().click(); f.tap();
await lundi.locator('.cz-mrow:not(.empty)').first().waitFor({ timeout: 5000 });
await f.shot(page, 'repas-ajoute', { screen: 'Cuisine/semaine', note: 'lundi composé' });

// 8) Envoyer → volet « Sécuriser » (on s'arrête AVANT l'auth réelle)
await page.getByLabel('Partager le menu').click(); f.tap();
await page.locator('.cz-sheet.show').waitFor({ timeout: 5000 });
await page.waitForTimeout(400);
await f.shot(page, 'partage-ouvert', { screen: 'Cuisine/partage', note: 'feuille de partage (Fatima pré-sélectionnée ?)' });
// tenter d'atteindre le CTA d'envoi (selon l'état, liste ou envoi direct)
const cta = page.locator('.cz-sheet.show .cz-cta').last();
await cta.click().catch(() => {}); f.tap();
await page.waitForTimeout(500);
const securiser = await page.getByText('Sécurise ta page', { exact: false }).count();
if (securiser) {
  await f.shot(page, 'securiser-volet', { screen: 'Partage/Sécuriser', note: 'compte transparent — STOP avant OTP réel (backend)' });
  f.decision(); // l'app exige e-mail + code (non joué : prod)
}

await f.writeMetrics('A1 — De l\'installation à la première page envoyée', `## Limite de capture (règle « jamais la prod »)
Le film s'arrête à l'apparition du volet **« Sécuriser ta page »** : la suite (saisie e-mail →
« Recevoir mon code » → code 6 chiffres → « Envoyé ✓ ») déclenche l'**OTP réel** (envoi d'un
e-mail via le backend). Non joué pour ne pas toucher la prod ni le compte staging (creds absentes
de l'env de capture). **À compléter à la main** sur staging avec le compte smoke. Le rendu du
volet lui-même (étape e-mail) est capturé ; les étapes code + confirmation manquent.

## Lecture doctrine (par défaut simple / paramétrage au rang 2)
Décisions demandées AVANT d'avoir une page à soi : domaines (×N) + nommage cuisinière (prénom +
langue) + composer 1 repas (choisir plat) + sécuriser (e-mail + code). Candidat n°1 à alléger :
le nommage prénom+langue **pourrait** être différé au premier envoi (déjà l'option « Plus tard »).`);

console.log(`A1 : ${f.n} états, ${f.taps} taps, ${f.decisions} décisions →`, dir);
await browser.close();
