// C — Le système IA en transversal (friction PO : « pas clair, mal présenté, y compris FTUE,
// paramétrage imprécis »). CHAQUE endroit où l'IA apparaît + un INVENTAIRE (où · promesse · params · produit).
import { open, Film, bypassFtue, installCollection } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const dir = 'ux-captures/C-systeme-ia';
const { browser, page } = await open();
const f = new Film(dir);
const inv = []; // { ou, promesse, params, produit }

await bypassFtue(page);

// 1) « Générer la semaine » — état bibliothèque VIDE (garde-fou F5b)
await page.locator('.mz-prow', { hasText: 'Cuisine' }).first().click();
await page.getByText('Générer la semaine').waitFor({ timeout: 8000 });
await f.shot(page, 'ia-generer-biblio-vide', { screen: 'Cuisine/générer (vide)', note: 'garde-fou F5b : propose la collection au lieu de l\'IA' });
await page.getByText('Générer la semaine').click(); f.tap();
await page.waitForTimeout(600);
await f.shot(page, 'ia-generer-vide-resultat', { screen: 'Cuisine/générer (vide)', note: 'ce que fait « Générer » sans recette' });
inv.push({ ou: 'Cuisine › « Générer la semaine » (bibliothèque vide)', promesse: 'Générer la semaine', params: 'aucun visible', produit: 'F5b : redirige vers la collection (pas d\'IA sur biblio vide)' });

// 2) « Générer la semaine » — état PLEIN. On est déjà dans Cuisine (le garde-fou a
// ouvert Collections) : fermer, installer via l'onglet Recettes, revenir à Semaine.
await page.locator('.cz-overlay.show, .cz-x').first().click({ position: { x: 8, y: 8 } }).catch(() => {});
await page.waitForTimeout(300);
await page.getByRole('tab', { name: 'Recettes' }).click();
const pkt = page.locator('.cz-pkt', { hasText: 'Fonds de départ' });
if (await pkt.count()) {
  await pkt.click();
  await page.locator('.cz-sheet.show .cz-cta').click();
  await page.locator('.cz-librow').first().waitFor({ timeout: 5000 });
}
await page.getByRole('tab', { name: 'Semaine' }).click();
await f.shot(page, 'ia-generer-biblio-pleine', { screen: 'Cuisine/générer (plein)', note: 'bouton « Générer la semaine » actif' });
inv.push({ ou: 'Cuisine › « Générer la semaine » (biblio pleine)', promesse: 'Générer la semaine', params: 'objectif kcal + repas vides détectés', produit: 'complète les repas vides par IA (quota serveur) — connexion requise' });

// 3) IA dans le composeur de repas (complétion)
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await f.shot(page, 'ia-composeur', { screen: 'Cuisine/composeur', note: 'toute mention IA dans le composeur (complétion ?)' });
inv.push({ ou: 'Cuisine › composeur de repas', promesse: '(complétion IA du repas si présente)', params: 'rôle + objectif', produit: 'plat proposé' });
await page.locator('.cz-sheet.show .cz-x').first().click().catch(() => {});

// 4) IA dans l'ajout de recette (« Coup de main IA »)
await page.getByRole('tab', { name: 'Recettes' }).click();
await page.locator('.cz-fab').click(); f.tap();
await page.getByText('Nouvelle recette', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(page, 'ia-ajout-recette', { screen: 'Recettes/ajout', note: '« Coup de main IA » : promesse + état grisé si hors quota/connexion' });
inv.push({ ou: 'Recettes › « Coup de main IA »', promesse: 'Coup de main IA', params: 'texte libre (nom/description)', produit: 'recette structurée + macros (grisé hors connexion/quota)' });

await browser.close();

// 5) Mention IA dans la FTUE (le prompt PO cible « y compris dans la FTUE »)
const s2 = await open();
const p2 = s2.page;
await p2.goto(process.env.BASE_URL || 'http://localhost:4173/Heath/', { waitUntil: 'networkidle' });
await p2.getByText('Manzil vous aide', { exact: false }).waitFor({ timeout: 10000 });
await p2.getByRole('button', { name: 'Entrer', exact: true }).click();
await p2.getByText('Par quoi voulez-vous commencer', { exact: false }).waitFor({ timeout: 5000 });
await f.shot(p2, 'ia-ftue-domaines', { screen: 'FTUE/domaines', note: 'chercher toute mention/promesse IA dans la FTUE' });
inv.push({ ou: 'FTUE', promesse: '(à qualifier : la FTUE mentionne-t-elle l\'IA ? — capture pour juger)', params: '—', produit: '—' });
await s2.browser.close();

writeFileSync(`${dir}/INVENTAIRE.md`, `# C — Système IA : inventaire transversal

Chaque endroit où l'IA apparaît, avec : **où · ce que le bouton promet (texte) · paramètres
demandés · ce que ça produit**. Friction PO : « pas clair, mal présenté, paramétrage imprécis ».

| Où | Promesse (texte bouton) | Paramètres demandés | Produit |
|---|---|---|---|
${inv.map((i) => `| ${i.ou} | ${i.promesse} | ${i.params} | ${i.produit} |`).join('\n')}

## Lecture pour le chantier
L'IA apparaît à ≥4 endroits (générer semaine · composeur · ajout recette · FTUE), avec des
promesses et un conditionnement (connexion + quota) hétérogènes. Le **quota/réglage IA** vit dans
Compte (non capturé ici — état connecté). Candidat doctrine : un langage IA unifié (même verbe,
même promesse, même façon de dire « connecte-toi / quota »), et le paramétrage IA au rang 2.`);

f.writeMetrics('C — Système IA (transversal)', `Voir \`INVENTAIRE.md\` pour le tableau où/promesse/params/produit.
${f.n} captures des points d'apparition IA. Le réglage/quota IA (dans Compte, état connecté)
n'est pas capturable sans backend — listé au RECAP.`);

console.log(`C : ${f.n} états, ${inv.length} points IA →`, dir);
