# B3 — Compte & accès au foyer — métriques UX

> Capturé automatiquement (passe 1, doctrine « par défaut simple, paramétrage au rang 2 »).

| Métrique | Valeur |
|---|---|
| Écrans distincts traversés | **1** |
| Taps (gestes) | **1** |
| Décisions demandées (saisie/choix exigés) | **0** |
| États capturés | 1 |

## États, dans l'ordre du geste
| # | Fichier | Écran | Note |
|---|---|---|---|
| 01 | 01-compte-deconnecte.png | Compte/déconnecté | « Mets ta maison à l'abri » : e-mail + code, « continuer sans compte », « Revoir l'introduction » |

## Constats
- Déconnecté : connexion e-mail+code proposée (jamais imposée) + « Revoir l'introduction ».
- Connecté (non capturable sans backend) : « Exporter mes données », « Se déconnecter », section Foyer partagé (Inviter → code · Rejoindre · Quitter), « Supprimer mon compte », « Revoir l'introduction ». Source : src/components/AccountSheet.tsx.
- MEMBRES DU FOYER (≠ destinataires) — TROU FONCTIONNEL : aucune UI ne LISTE les membres du foyer, ni n'en RETIRE un. « Inviter » génère un code ; « Quitter le foyer » sort soi-même ; la suppression de compte transfère au plus ancien. Mais un propriétaire ne peut PAS voir « qui a accès » ni révoquer l'accès d'un co-gestionnaire. (Vérifié : `membres` n'est lu que pour la logique interne — currentFoyerId/leaveFoyer — jamais rendu en liste.)

## Limite de capture
L'état CONNECTÉ de la feuille Compte exige une session réelle (OTP e-mail → backend prod) —
non joué. Ses actions sont inventoriées depuis le code (AccountSheet.tsx). À compléter à la main
sur staging avec le compte smoke.

## Trou fonctionnel tracé (à décider au chantier, PAS inventé)
**« Consulter / modifier qui a accès au foyer » n'existe pas.** Le foyer partagé se gère par
invitation (code) et départ volontaire ; il manque : (1) voir la liste des membres (compte +
rôle owner/membre), (2) retirer l'accès d'un membre. C'est la friction PO « consulter/modifier
qui a accès » — aujourd'hui sans réponse produit.
