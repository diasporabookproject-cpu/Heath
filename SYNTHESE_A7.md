# Synthèse A7 — « le turnover »

**Rappel de lecture · dérivé de `READOUT_A7_DESIGN.md` (v2, décisions verrouillées le 15/07) + statut à jour au 19/07.**
Ce document ne décide rien — il résume. La source de vérité du design reste `READOUT_A7_DESIGN.md`.

---

## Ce qu'est A7
Le parcours-thèse de la passe UX : **gérer les allées et venues des gens de maison**. Un départ, une arrivée.
C'est le dernier volet UX au design clos, et **le prochain vrai lot de code**.

**Le modèle retenu — « couper / créer » :**
- **Un départ = Retirer** — couper le lien, point. Pas de « poste vacant », pas de fourche successeur.
- **Une arrivée = Ajouter une personne** — prénom · rôle · langue · périmètre de page.
- **Éliminés** : l'écran « poste vacant », la fiche personne (les 2 actions vivent sur la carte du hub via ⋯), le « poste explicite ».
- La thèse se raconte **à l'affectation**, factuellement — jamais en bannière.

---

## Les décisions verrouillées (D1–D12) — les structurantes

| # | Décision |
|---|---|
| **D1** | Le mot est **« Retirer »** partout (menu/titre/bouton). « Supprimer » écarté (fabrique l'angoisse de perte). Le fait « son lien ne donnera plus rien » est porté par **l'écran**. |
| **D2** | **Neutralité de genre** — « Cuisine » pas « Cuisinière » ; **aucun pronom inféré d'un prénom**. Le code viole encore cet invariant (F6). |
| **D3** | **Pas de fiche personne** — hub → ⋯ → { Modifier · Retirer }. |
| **D4** | **Rôle = liste ouverte + « Autre… »** (champ libre, `role: string` existe déjà). Accueille « Famille ». |
| **D5** | **Langue = liste fermée** (un champ libre = promesse de traduction intenable). Catalogue à 4 : **Français · Darija · Arabe classique · Anglais**. |
| **D6** | « Arabe classique » = libellé ; le registre visé = **arabe standard moderne (fusha)**, pas coranique. Une nounou lit une consigne d'urgence → besoin du MSA. |
| **D7** | **Option 1 « la parité »** — une fonction par personne (le domaine **vient du rôle**) **+ « La maison » cochable pour tout le monde**. |
| **D8** | **Re-cochage assumé** — retirer une personne détruit ses fiches Sécurité et ses `enfants[]` ; la suivante repart de zéro. À **chiffrer** dans le film mesuré. |
| **D10** | Bloc **« Sa page contient »** — périmètre montré et coché où permis. Rôle et contenu **découplés** (un Chauffeur ne voit que « La maison »). |
| **D11** | Garde-fou **passif** sur « Modifier » (une ligne à la saisie du prénom, pas de modale). |

---

## Le cœur technique de D7 (option 1)
**Le trou bouché est sérieux** : une personne **Nounou ne peut recevoir aucune fiche Sécurité**
(`NounouDest` n'a pas de `securiteIds`). La personne seule à la maison avec les enfants est la seule à ne pas
pouvoir recevoir « où couper l'eau » ou le numéro du gardien — alors que la Cuisine, si.
**C'est de la sécurité domestique, pas du confort.**

Abordable car le payload Cuisine est **déjà multi-sections** (`{v, langue, nom, role, persons, menu, securite}`)
et tourne en prod. L'option 1 **réplique un patron prouvé** — coût **🟡 M, sans SQL, sans migration**.

L'**option 2** (fusion : une personne qui cuisine ET garde) est **différée, pas écartée** — son vrai prix est
une couche de compat perpétuelle (liens déjà distribués = éternels), et la douleur n'a jamais été signalée.
Signal à guetter : *un foyer crée deux personnes du même prénom.*

---

## Statut des prérequis — tous levés ✅
L'ordre de livraison était : lot Cuisine → mini-lot destinataires → audit §7.8 → **A7**.
- ✅ Lot Cuisine CLOS
- ✅ Mini-lot destinataires CLOS (18/07) — `revokeEspace` fiabilisé, remappage `'ar'`→`'dr'`, migration device 4/4
- ✅ Audit sécurité §7.8 CLOS (18/07) — dont **C4 câblé** (le geste Retirer Nounou)

**Donc A7 n'a plus de bloquant amont. Il ne reste que son propre chantier.**

---

## Ce qui reste à faire pour lancer A7
1. **Film mesuré** — taps réels depuis le hub pour Retirer et Ajouter ; **chiffrer D8** (le coût du re-cochage,
   qui grandit à chaque champ posé sur le destinataire).
2. **Spec §8** — qui doit trancher les **questions encore ouvertes** (ci-dessous).
3. **Read-back + chiffrage** (Claude Code) → GO → tranches → STOP → **test device foyer neuf**.

---

## Décisions encore ouvertes (à trancher dans la spec §8)
- **D4 + D10 contre le modèle** : `PersonneKind = 'cuisine'|'nounou'` et le `menu` est **inconditionnel** dans
  `publishEspace` — un Chauffeur recevrait le menu, ou pire le planning des enfants.
  → **3ᵉ sorte de page, ou payload conditionnel** (≈ un pas vers l'option 2).
- **Vocabulaire banni dans l'UI** — `PartageSheet.ROLES` (« Cuisinière »…) + défaut de création rapide, idem FTUE
  → neutralité D2, liste ouverte + « Autre… ».

---

## Les 6 pièges à graver dans la spec §8
1. 🔴 **`nounouSig()` doit inclure `securite`** — sinon « à jour » ment sur du contenu de **sécurité**.
2. 🔴 **Contrat de page publiée perpétuel** — ajouter `securite?` au payload Nounou doit rester lisible par les
   liens déjà distribués.
3. 🟡 **Couplage `statut: 'Validé'`** — `buildSecurite` filtre sur le même enum que les recettes (garantie **G2**
   du lot Cuisine) → A7 doit se plier au test de verrouillage.
4. 🟡 **`buildSecurite()`** couplé à l'upload audio Cuisine ; Nounou a son propre chemin audio → à réconcilier,
   pas copier-coller.
5. 🟡 **Rendu de la section Sécurité** (dans `EspaceView`) → à extraire en composant partagé.
6. ✅ **C4** (le geste Nounou) — *déjà fait* à l'audit §7.8.

---

**En une phrase :** A7 = le turnover « couper/créer », design verrouillé, tous les prérequis levés — il ne reste
que le **film mesuré** (chiffrer le re-cochage D8) puis la **spec §8** (trancher la 3ᵉ sorte de page + le
vocabulaire), et le cœur code est **D7 : donner les fiches Sécurité à la Nounou** en répliquant le patron
multi-sections déjà en prod.
