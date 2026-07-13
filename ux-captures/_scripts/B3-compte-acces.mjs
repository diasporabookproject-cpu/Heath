// B3 — Compte & accès au foyer (frictions PO : gérer mon compte · qui a accès).
// États de la feuille Compte + vérification FACTUELLE : peut-on VOIR / RETIRER les MEMBRES
// du foyer (≠ destinataires) ? Ce qui n'existe pas → trou tracé au RECAP (rien inventé).
import { open, Film, bypassFtue } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const dir = 'ux-captures/B-lieux/B3-compte-et-acces';
const { browser, page } = await open();
const f = new Film(dir);
const constats = [];

await bypassFtue(page, { roles: ['cuisine', 'nounou'] });

// Ouvrir la feuille Compte (bouton ☁︎ du hub)
await page.getByLabel('Compte et réglages').click(); f.tap();
await page.waitForTimeout(600);
await f.shot(page, 'compte-deconnecte', { screen: 'Compte/déconnecté', note: '« Mets ta maison à l\'abri » : e-mail + code, « continuer sans compte », « Revoir l\'introduction »' });
const txtDeco = await page.locator('.mz-sheet, .app').first().innerText();
constats.push('Déconnecté : connexion e-mail+code proposée (jamais imposée) + « Revoir l\'introduction ».');

// Inventaire des actions visibles déconnecté (innerText)
writeFileSync(`${dir}/INNERTEXT-deconnecte.md`, `# B3 — feuille Compte (déconnecté) — innerText\n\n\`\`\`\n${txtDeco.trim()}\n\`\`\`\n`);

// L'état CONNECTÉ (export, déconnexion, inviter, rejoindre, quitter, supprimer, « Revoir l'intro »)
// ne s'atteint pas sans session réelle (OTP → prod). On le documente depuis le code.
constats.push('Connecté (non capturable sans backend) : « Exporter mes données », « Se déconnecter », section Foyer partagé (Inviter → code · Rejoindre · Quitter), « Supprimer mon compte », « Revoir l\'introduction ». Source : src/components/AccountSheet.tsx.');

// VÉRIFICATION FACTUELLE — liste des MEMBRES du foyer (co-gestionnaires avec compte) :
// recherche d'un écran/bouton listant les membres, ou retirant un membre.
constats.push('MEMBRES DU FOYER (≠ destinataires) — TROU FONCTIONNEL : aucune UI ne LISTE les membres du foyer, ni n\'en RETIRE un. « Inviter » génère un code ; « Quitter le foyer » sort soi-même ; la suppression de compte transfère au plus ancien. Mais un propriétaire ne peut PAS voir « qui a accès » ni révoquer l\'accès d\'un co-gestionnaire. (Vérifié : `membres` n\'est lu que pour la logique interne — currentFoyerId/leaveFoyer — jamais rendu en liste.)');

f.writeMetrics('B3 — Compte & accès au foyer', `## Constats
${constats.map((x) => '- ' + x).join('\n')}

## Limite de capture
L'état CONNECTÉ de la feuille Compte exige une session réelle (OTP e-mail → backend prod) —
non joué. Ses actions sont inventoriées depuis le code (AccountSheet.tsx). À compléter à la main
sur staging avec le compte smoke.

## Trou fonctionnel tracé (à décider au chantier, PAS inventé)
**« Consulter / modifier qui a accès au foyer » n'existe pas.** Le foyer partagé se gère par
invitation (code) et départ volontaire ; il manque : (1) voir la liste des membres (compte +
rôle owner/membre), (2) retirer l'accès d'un membre. C'est la friction PO « consulter/modifier
qui a accès » — aujourd'hui sans réponse produit.`);

console.log(`B3 : ${f.n} états, ${constats.length} constats →`, dir);
await browser.close();
