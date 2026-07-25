# Passation UI — Lot « Identité & accès », Phase 1

**Étape ③ du processus** (l'inventaire §6 du read-back devient des écrans) · en attente de validation PO avant ④.
Réponse au document `READBACK_IDENTITE_ACCES.md`. Aucun code écrit.

---

## 1. Le paquet — trois fichiers font foi

| Fichier | Contenu | Statut |
|---|---|---|
| `LOT-IDENTITE-ecrans-compiles.html` | **La référence.** Entrer (e-mail · code · erreur) · Le foyer (choix · saisie du code · foyer trouvé) · Le compte (page · avancé · suppression fondateur · suppression membre) + le bouton compte | **fait foi** |
| `maquette-page-morte-chargements.html` | La page morte du personnel (2 options) · la grammaire des états de chargement | **fait foi** |
| `maquette-derniers-ecrans.html` | Arrivée du membre · message d'invitation · code non généré · suppression sans dépendants | **fait foi** |

*Traces non normatives (itérations) : `maquette-ecran1-versions.html` (A/B — **B retenu**), `maquette-ecran1-compte.html`, `maquette-compte-simple.html`, `maquette-compte-foyer.html`, `maquette-compte-foyer-v2.html`, `maquette-lot-identite-suite.html`, `maquette-suppression-compte.html`.*

**Étape 0 avant tout code : committer les trois fichiers dans `docs/maquettes/`.** Une maquette validée se committe, elle ne vit pas dans un chat.

---

## 2. Couverture de l'inventaire §6

| # | Surface | Écran livré |
|---|---|---|
| 1 | Gate pré-boot | invisible — rien à dessiner |
| 2 | ① Connexion / création | **Entrer** : e-mail · code · erreur · 2 états de chargement |
| 3 | ② Le foyer (FTUE) | **Le choix** (Commencer / J'ai un code) — la suite de la FTUE reste en l'état |
| 4 | Page de compte | **Le compte** + variante « aucun code actif » + **Avancé** |
| 5 | SecuriserVolet | supprimé — rien à dessiner |
| 6-7 | Feuilles de partage | pas d'écran : **message court en français** (cf. §4) |
| 8 | Consentement fusion | supprimé — rien à dessiner |
| 9 | Bouton compte | **pastille d'initiale**, un seul libellé, 4 emplacements |
| 10 | Page reçue | inchangée — **mais** voir la page morte, §3 |

### Les sept écrans hors inventaire
1. **Saisie du code d'invitation** — sans lui, un code partagé ne peut être saisi nulle part.
2. **« C'est bien cette maison ? »** — on ne rejoint pas un foyer à l'aveugle.
3. **Arrivée du membre** — voir §3.
4. **Message d'invitation** — le code seul est mort-né.
5. **Page morte du personnel** — voir §3.
6. **États de chargement** — six appels réseau dans ce lot.
7. **Suppression : trois variantes** — fondateur / membre / seul.

---

## 3. Les décisions que les maquettes engagent

Ce ne sont pas des choix graphiques : elles changent le code. À valider explicitement.

**a. Celui qui rejoint saute la FTUE.** Le foyer existe ; lui faire choisir domaines et équipe écraserait le travail du fondateur. L'écran d'arrivée **remplace** la FTUE pour lui. → **bifurcation de parcours** au gate.

**b. Le foyer mémorise qui l'a fondé.** Sans cette information, les deux confirmations de suppression sont indistinguables. Si le champ n'existe pas, c'est une ligne à ajouter.

**c. Supprimer le compte du fondateur coupe tous les dépendants** *(décision PO)* — membres et pages partagées. Corollaire assumé : **pas de transfert de propriété en Phase 1**, le fondateur ne peut pas partir sans tuer le foyer.

**d. La page morte a besoin d'une pierre tombale.** Quand la ligne `espaces` disparaît, **on ne sait plus quelle langue lit le destinataire**. Deux options dessinées :
- **A** — quatre langues empilées, zéro code, illisible pour qui n'en lit qu'une.
- **B** — une ligne résiduelle portant *seulement* la langue et l'état « révoqué » → une phrase, dans sa langue. **Recommandé.**

**e. La page morte doit gagner contre le cache.** La page du personnel est hors-ligne par conception : sans purge, elle continuera d'afficher l'ancien menu après la suppression — **un contenu périmé qui a l'air vivant**. C'est le point « purge du cache d'une page révoquée » de l'audit §7.8, devenu concret.

**f. Un seul écran mort pour deux causes.** Compte supprimé ou lien révoqué : indistinguable côté destinataire, et tant mieux.

**g. Le code d'invitation naît du geste**, vit 24 h. Pas de code permanent affiché en page de compte.

**h. Registre : vouvoiement.** L'Écran 1 est la première surface du produit ; il fixe le registre. → **`PROJET_MAISON_OS.md` §4 à amender** (« compte différé, vocabulaire de compte banni des surfaces » meurt avec ce lot), et l'incohérence FTUE/in-app se règle ici.

---

## 4. Ce qui a été volontairement retiré

**Les écrans hors-connexion** *(décision PO)* — pas d'écran « sans connexion », pas de bandeau « session expirée », pas d'écran dédié à l'échec de publication. Cela retire les **écrans**, pas la tolérance hors-ligne :

- Le gate reste sur le **drapeau local `compteLie`**, jamais sur la session vivante *(Q① du read-back)* — sinon l'app devient inutilisable sans réseau et les 3 smokes meurent.
- Tout échec réseau garde **une phrase en français**, jamais le message brut de Supabase *(contrainte 6.4-④)*. Un **motif d'erreur unique** est dessiné : cases en rouge + une ligne. Trois textes, un dessin — code invalide · code expiré · envoi impossible.

---

## 5. Grammaire des états de chargement

Concerne : envoyer le code · vérifier le code · rejoindre · fonder · partager · supprimer.

1. Le bouton **garde exactement sa taille** — seul le libellé change, rien ne saute.
2. Le champ **se verrouille** pendant l'appel, sans devenir illisible.
3. Un état de moins de **300 ms ne s'affiche pas** — un clignotement fatigue plus qu'il ne rassure.

---

## 6. Bloquants et réserves

- 🔴 **`manzil.ma` n'est pas acheté** et il n'y a pas de lien de store. Le message d'invitation en dépend : **il ne peut pas être finalisé** avant. Le lien de la maquette est un substitut.
- 🟡 **Couture visuelle** : l'écran ② est en DA v2, la suite de la FTUE (domaines, gabarits, personnes) ne l'est pas. La rupture se verra **chez le fondateur**, pas chez le membre. À traiter en lot UI, hors périmètre ici.
- 🟡 **Texte darija** de la page morte : **brouillon**, à valider par le PO avant implémentation.
- 🟡 **Se déconnecter sans confirmation** : un tap, et il faut du réseau pour revenir. À confirmer ou à assumer sciemment.

---

## 7. Rappel du gate

Read-back + chiffrage 🟢/🟡/🔴 + contestations → **attendre le GO** → livraison lot par lot + portes vertes (typecheck · tests · build · smoke · captures) + entrée `DEVLOG.md` + `ETAT.md` réécrit + **STOP**.

**Restent à trancher par le PO avant ④** : les 7 décisions du §8 du read-back · les corrections A/B/C au document de décision · le point **d** ci-dessus (A ou B) · et le calendrier — *le read-back note que si le test par des amis est proche, la Phase 2 devrait précéder la Phase 1*.
