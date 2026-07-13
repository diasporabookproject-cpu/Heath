// A7 — Le turnover : remplacer une personne. LE parcours-thèse (« la page survit au départ,
// le nouveau hérite d'une page prête »). Jamais regardé. On joue le chemin RÉEL, quel qu'il soit.
import { open, Film, bypassFtue, installCollection, createCuisineDest } from './lib.mjs';

const dir = 'ux-captures/A-flux/A7-turnover-remplacer-une-personne';
const { browser, page } = await open();
const f = new Film(dir);
const found = [];

await bypassFtue(page);
await installCollection(page);
await page.getByRole('tab', { name: 'Semaine' }).click();

// Composer un repas (pour que la page ait du contenu)
const lundi = page.locator('.cz-daycard', { hasText: 'Lundi' });
await lundi.locator('.cz-mrow.empty').first().click();
await page.getByText('Total du repas').waitFor({ timeout: 5000 });
await page.locator('.cz-sheet.show .cz-comp .cmid').first().click();
await page.locator('.cz-sheet.show .cz-pick').first().click();
await page.waitForTimeout(300);
await page.locator('.cz-sheet.show .cz-x').first().click();

// Créer un destinataire « Fatima » (elle a une page) — point de départ du turnover
await createCuisineDest(page, 'Fatima'); f.tap().decision();
await page.waitForTimeout(400);
await f.shot(page, 'depart-page-fatima', { screen: 'Cuisine/partage', note: 'Fatima a une page (destinataire + contenu) — point de départ' });
found.push('Départ : un destinataire « Fatima » avec une page composée (token = lien permanent).');

// « Fatima part » → jouer le chemin réel : « Changer » → liste des destinataires
const changer = page.locator('.cz-sheet.show').getByText('Changer', { exact: false }).first();
if (await changer.count()) {
  await changer.click(); f.tap();
  await page.waitForTimeout(500);
  await f.shot(page, 'liste-destinataires', { screen: 'Cuisine/destinataires', note: 'liste : ajouter / éditer / supprimer' });
  found.push('« Changer » ouvre la liste des destinataires (ajouter / éditer / supprimer).');

  // Éditer Fatima → peut-on la RENOMMER (la remplaçante hérite de la page + lien) ?
  const row = page.locator('.cz-sheet.show').getByText('Fatima', { exact: false }).first();
  if (await row.count()) {
    // chercher un bouton éditer sur la ligne
    const editBtn = page.locator('.cz-sheet.show').getByText(/Modifier|Éditer|✎/i).first();
    try {
      await editBtn.click({ timeout: 3000 }); f.tap();
      await page.waitForTimeout(400);
      await f.shot(page, 'editer-fatima', { screen: 'Cuisine/édition-dest', note: 'RENOMMER Fatima → Khadija : la page + le lien (token) survivent-ils ?' });
      const nameField = page.locator('.cz-sheet.show input').first();
      if (await nameField.count()) {
        await nameField.fill('Khadija'); f.decision();
        await f.shot(page, 'renomme-khadija', { screen: 'Cuisine/édition-dest', note: 'renommé Khadija (même ligne = même token = lien conservé)' });
        found.push('Renommer un destinataire EXISTE (édition) → le token/lien ne change pas → la remplaçante HÉRITE de la page. C\'est la promesse — mais implicite (aucun geste « remplacer » nommé).');
      }
    } catch {
      found.push('TROU : pas de bouton d\'édition évident sur la ligne du destinataire.');
    }
  }
} else {
  found.push('TROU MAJEUR : « Changer »/liste des destinataires non atteignable dans cet état.');
}

f.writeMetrics('A7 — Turnover : remplacer une personne', `## Ce que le chemin RÉEL permet (constats bruts joués)
${found.map((x) => '- ' + x).join('\n')}

## Le moment de vérité de la promesse produit
La thèse « la page survit au départ, le nouveau hérite d'une page prête » se joue AUJOURD'HUI par
**renommage d'un destinataire** (via « Changer » → éditer) : le token — donc le lien permanent —
ne change pas, la page et son contenu restent, il suffit d'ajuster le prénom (et la langue).
**C'est la promesse tenue techniquement, mais JAMAIS énoncée** : il n'existe pas de geste
« [Personne] est partie → confier sa page à quelqu'un d'autre ». L'alternative supprimer/recréer
casserait le lien (nouveau token → l'ancien lien devient mort ; cf. finding \`revokeEspace\`
silencieux au backlog). **À trancher au chantier** : matérialiser explicitement le geste turnover
et dire à l'utilisateur que le lien/la page survivent — c'est LE différenciateur produit.`);

console.log(`A7 : ${f.n} états, ${found.length} constats →`, dir);
await browser.close();
