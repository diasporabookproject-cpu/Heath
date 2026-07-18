# READOUT A7 « le design » — **v2 · décisions verrouillées**
**15 juillet 2026 · chantier UX passe 1 · parcours-thèse A7 « le turnover »**

> **⚠️ Le rôle de ce document a changé.** La v1 était une demande d'audit. La Q&A a répondu
> (`RAPPORT_QA_A7_DESIGN.md`, code audité `lot-cuisine-v1` @ `d8e94e5`) et le PO a tranché.
> **Cette v2 est l'état consolidé du design A7** : elle ne demande plus rien, elle enregistre.
> C'est la base du **film mesuré**, puis de la **spec §8**.

**Sources :** `READOUT_A7_TURNOVER_POUR_QA.md` v2 (diagnostic) · `RAPPORT_QA_A7.md` · `RAPPORT_QA_A7_DESIGN.md` ·
décisions PO des 14–15 juillet.
**Maquette de référence :** `proto-a7-cliquable.html` (à jour · remplace toutes les explorations).

---

## 1. Le modèle — « couper / créer »

Le geste « remplacer » groupé a été abandonné. Formulation PO : « *s'il y a une nouvelle personne qui arrive,
on recrée un user et on lui affecte ce qu'on veut* ».

- **Un départ = Retirer.** Le seul acte essentiel : couper le lien. Pas de fourche successeur.
- **Une arrivée = Ajouter une personne.** Prénom · rôle · langue · périmètre de page.
- **Éliminés :** l'écran « poste vacant » · la **fiche personne** (les deux actions vivent sur la carte du hub
  via ⋯) · le modèle « poste explicite ».
- **La thèse se raconte à l'affectation**, factuellement (ce que contient le domaine), **jamais en bannière**.

---

## 2. Décisions PO — verrouillées

| # | Décision | Note |
|---|---|---|
| **D1** | **« Retirer »** — le menu, le titre et le bouton disent **le même mot**. « Supprimer » écarté (il fabrique l'angoisse de perte que le produit existe pour dissoudre ; objet ambigu). Le fait critique — « son lien ne donnera plus rien » — est porté par **l'écran**. | |
| **D2** | **Neutralité de genre** — « Cuisine » et non « Cuisinière » ; **aucun pronom inféré d'un prénom** (l'app ne connaît pas le genre). | Le code viole cet invariant (§4-F6) ; la maquette aussi le violait (§6). |
| **D3** | **Pas de fiche personne** — hub → ⋯ → { Modifier · Retirer }. | |
| **D4** | **Rôle = liste ouverte + « Autre… »** (champ libre). Accueille les non-employés (entrée « Famille »). | Gratuit : `role: string` existe déjà. |
| **D5** | **Langue = liste fermée**, pas de champ libre (ce serait une **promesse de traduction** intenable). **Catalogue à quatre, inchangé : Français · Darija · Arabe classique · Anglais**, dans cet ordre. | L'invariant §4 du doc tient — **pas de v2.2 de ce côté**. |
| **D6** | **« Arabe classique » = le libellé** ; **le registre visé côté traduction est l'arabe standard moderne (fusha)**, pas le registre coranique. | ⚠️ **À porter dans la fiche de remappage (§5)** : c'est elle qui définit ce que chaque code signifie. Une nounou qui lit une consigne d'urgence a besoin du MSA. |
| **D7** | **Option 1 « la parité »** — une fonction par personne (le domaine **vient du rôle**, il ne se coche pas) **+ « La maison » cochable pour tout le monde**. | Détail et raison : §3. |
| **D8** | **Re-cochage assumé** — retirer une personne détruit ses fiches Sécurité cochées et ses `enfants[]` ; la suivante repart de zéro. Re-confirmer explicitement est plus sûr qu'hériter en silence. | **Le film mesuré doit le chiffrer**, pas le supposer. Le coût grandit à chaque champ posé sur le destinataire. |
| **D9** | **Accusés de lecture : perte assumée** à la coupure. Personne n'a demandé cet historique ; l'archiver demanderait de sortir l'accusé de la ligne `espaces`. | À rouvrir si l'usage le réclame. |
| **D10** | **Bloc « Sa page contient »** — le périmètre se **montre** et se coche là où c'est permis. Un rôle sans écran dédié (Chauffeur, Entretien, Famille…) n'affiche que « La maison » : **rôle et contenu sont découplés**. | |
| **D11** | **Garde-fou passif sur « Modifier »** — une ligne qui apparaît à la saisie du prénom. Pas d'heuristique, pas de modale ; le renommage honnête reste libre. | |
| **D12** | **Mini-lot « destinataires » (option A)** — les trois corrections voyagent ensemble : `revokeEspace` · `revoked` · remappage langue. | §5. |

---

## 3. D7 — pourquoi l'option 1, et pourquoi pas la 2 maintenant

**Le trou que l'option 1 bouche est réel, et il est sérieux.** Une personne Nounou ne peut recevoir **aucune**
fiche Sécurité (`NounouDest` n'a pas de `securiteIds`) : **la personne seule à la maison avec les enfants est
la seule à ne pas pouvoir recevoir le numéro du gardien ni le geste « où couper l'eau »** — alors que la
personne Cuisine, si. Ce n'est pas du confort, c'est de la sécurité domestique.

**Pourquoi c'est abordable (correction Q&A, meilleure que mon argument).** Le payload Cuisine est **déjà un
conteneur multi-sections** — `{ v, langue, nom, role, persons, menu, securite }` — et il **tourne en
production**. `buildSecurite()` va de `dest.securiteIds` jusqu'à la section `securite` de la page, sans trou.
**L'option 1 n'invente pas le multi-domaine : elle réplique un patron prouvé.** Coût réel **🟡 M** (mon
« petit » était optimiste), **sans SQL, sans migration**.

**Pourquoi la 2 n'est pas payée maintenant.** Mon inventaire était faux sur le fond : `espace.ts:154` et
`nounou/partage.ts:129` écrivent dans **la même table `espaces`**, une ligne par token, payload JSON discriminé
par `kind`. Donc **zéro migration SQL, zéro changement RLS** — mon item « RLS et sync sur le modèle fusionné »
s'évapore. Le **vrai** prix de la fusion est ailleurs : **les liens déjà distribués sont perpétuels**
(invariant « le lien ne change jamais »), donc le lecteur devra savoir lire les **anciennes formes de payload
pour toujours** — une **couche de compatibilité permanente**, pas une migration. Son bénéfice (le cas « la même
personne cuisine ET garde les enfants », plus la dette d'invariant « un seul lien durable par personne » —
cette personne a aujourd'hui **deux fiches et deux liens**) **n'a jamais été signalé comme une douleur réelle**.

**L'option 2 n'est pas écartée, elle est différée.** L'écran ne changera pas le jour où on la paiera : la ligne
fixe deviendra cochable. *(Instrumentation à prévoir : personne ne « demandera » la fusion — un foyer concerné
créera simplement deux personnes du même prénom. C'est ce signal-là qu'il faudra guetter.)*

---

## 4. Constats de code — vérifiés par la Q&A sur HEAD (`d8e94e5`)

| # | Constat | Verdict Q&A |
|---|---|---|
| **F1** | `securiteIds` câblé de bout en bout côté Cuisine (UI → modèle → page → signature de transmission). | ✅ **Confirmé et plus fort** : le payload est déjà multi-sections. |
| **F2** | `NounouDest` n'a **pas** de `securiteIds` → asymétrie **totale**. La fiche urgence Nounou est un contenu *interne* au domaine, **sans rapport** avec les fiches Sécurité du foyer. | ✅ Confirmé. |
| **F3** | Deux stores de destinataires ; `personnes.ts` = adaptateur de lecture ; clé `kind + token`. | ✅ Confirmé. |
| **F4** | `publishEspace` spécifique Cuisine. | ⚠️ **Vrai mais trompeur** — la fonction est spécifique, **le transport ne l'est pas** (même table). |
| **F5** | Cuisine n'accepte que `langue: 'fr' \| 'ar'`. | ✅ Confirmé **et pire** → §5. |
| **F6** | Vocabulaire banni dans la source (commentaire de `Destinataire` : « Cuisinière / Femme de ménage »). | ✅ Confirmé. |
| **F7** | `role: string` déjà libre des deux côtés. | ✅ Confirmé. |

*Les numéros de ligne ont bougé (T3 a inséré `ReglesFoyer` dans `types.ts`) ; le lot Cuisine n'a rien déplacé
de substantiel.*

---

## 5. Le mini-lot « destinataires » — avant A7 (D12)

**Structure retenue :** un lot, **trois fiches**, **la migration dans sa propre tranche avec sa propre porte**
(STOP + test device dédié). *Recommandation de ma part, pas une exigence PO : on garde la cohérence du modèle
sans mélanger deux profils de risque — une correction de comportement et une migration de données. La leçon
d'idempotence du lot Environments s'applique.*

### Fiche 1 — `revokeEspace` fiabilisé *(prérequis dur d'A7)*
Aujourd'hui : `if (!supa) return;` (hors-ligne ou session absente → **la fonction ne fait rien**) · le résultat
du `DELETE` **n'est pas vérifié** · l'appelant toaste « son lien ne donne plus rien » **dans tous les cas**.
→ **« Retirer » mentirait.** Erreurs propagées, toast honnête, file de retry.

### Fiche 2 — le champ `revoked`, aujourd'hui mort → **proposition de câblage**
`revoked?: boolean` est déclaré sur `Destinataire`, **jamais lu, jamais écrit**. Quelqu'un a posé l'intention
et ne l'a pas câblée. **Proposition** *(à valider techniquement par Claude Code / la Q&A)* — il résout
précisément le trou hors-ligne de la fiche 1 :

1. Au geste « Retirer », écrire **`revoked: true` localement d'abord** (IndexedDB — toujours possible,
   hors-ligne compris). Conforme à l'invariant local-first : l'appareil est la vérité d'usage.
2. La personne **disparaît immédiatement du hub** (l'UI filtre sur `revoked`) — le geste est ressenti comme
   fait, parce qu'il l'est *localement*.
3. La **file de retry** (fiche 1) porte l'appel serveur `revokeEspace` jusqu'à confirmation.
4. Tant que ce n'est pas confirmé, l'UI peut **dire vrai** : « retiré — son lien sera coupé dès que tu seras
   en ligne », au lieu de mentir.

**Ce que ça achète :** le champ mort devient la solution du trou ; « Retirer » cesse de mentir sans devenir
bloquant hors-ligne.
**Questions ouvertes à instruire :** ① le mécanisme de **tombstones** de la sync couvre-t-il déjà ce besoin
(auquel cas `revoked` est vraiment redondant → **le supprimer**) ? ② `revoked` doit-il se synchroniser, ou
rester purement local le temps de la file ? ③ la fiche destinataire est-elle finalement **supprimée** après
confirmation, ou conservée en `revoked` ? *(Le modèle couper/créer plaide pour la suppression : `revoked`
serait alors un **état transitoire**, pas un état de repos.)*
**Consigne :** ne pas laisser ce champ dormir — **le câbler ou le supprimer**.

### Fiche 3 — le remappage langue *(le piège majeur du dossier)* · 🟡 M · **tranche isolée**
```
espace.ts:133 → const recipes = dest.langue === 'ar' ? await augmentDarija(...) : byId;
```
**Côté Cuisine, `'ar'` signifie DARIJA. Côté Nounou, `'ar'` signifie arabe classique et `'dr'` signifie darija.**
Le même string veut dire **deux choses opposées** selon le domaine.

**Rayon d'explosion :** élargir le type Cuisine au catalogue (D5) **sans remappage** ferait basculer **tous les
destinataires Cuisine `'ar'` de la darija vers l'arabe classique — en silence**. Aucune erreur, aucun log :
juste une page devenue illisible pour la personne qui la reçoit.
→ **Migration de remappage explicite `'ar'` → `'dr'`, idempotente et testée, AVANT tout élargissement.**
La fiche doit **définir noir sur blanc ce que chaque code signifie** — et c'est là que **D6** atterrit
(`'ar'` = arabe standard moderne / fusha ; libellé UI « Arabe classique »).

---

## 6. La maquette — corrections appliquées

- 🔴 **Violation de genre corrigée** (relevée par la Q&A) : « **Elle** sort de ton équipe » →
  « **Fatima** sort de ton équipe ». L'app ne connaît qu'un prénom ; le pronom était une présomption —
  exactement ce que D2 bannit.
- 🔴 **Seconde violation, non relevée par la Q&A**, corrigée : le garde-fou disait « sinon **elle** garderait
  son lien » → « sinon **Fatima** garderait son lien ».
- ⚪️ **Le « Cuisinière » relevé en 🟡 est un faux positif** : l'occurrence est dans la **note de rationale**,
  la phrase qui énonce la règle (« « Cuisine », pas « Cuisinière » »). C'est la logique que la Q&A applique
  elle-même correctement à « Supprimer », qu'elle dédouane parce qu'il n'apparaît que dans la note.
- ✅ **Écran « Ajouter » refait pour D7** : le domaine de la fonction est **montré, non cochable** ;
  « La maison » est le seul vrai toggle ; un rôle sans écran dédié n'affiche que « La maison ».
- 📝 **Rappel d'implémentation** : la maquette charge Fraunces / Plus Jakarta via Google Fonts →
  **polices à embarquer** (précédent T1 : woff2 locaux, zéro requête googleapis, vérifié réseau coupé).

---

## 7. Les pièges à graver dans la spec §8

1. **🔴 `nounouSig()` doit inclure `securite`.** Oublié, l'état de transmission dira « à jour » alors qu'une
   fiche a changé — **le mensonge d'état**, sur du contenu de sécurité.
2. **🔴 Le contrat de page publiée est perpétuel.** L'invariant « le lien ne change jamais » est une contrainte
   d'architecture sur **toute** évolution de payload, pas seulement sur la fusion. Ajouter `securite?` au
   payload Nounou doit rester lisible par les liens déjà distribués.
3. **🟡 Le couplage `statut: 'Validé'`.** `buildSecurite` filtre sur le **même enum que les recettes** — celui
   dont dépend la garantie **G2** du lot Cuisine. Toute évolution du statut côté A7/Sécurité peut casser G2
   **en silence**. Le test de verrouillage exigé en T5 couvre les recettes ; **A7 doit s'y plier aussi**.
4. **🟡 L'extraction de `buildSecurite()`.** Privée à `espace.ts`, signature `Destinataire`, et **couplée à
   l'upload audio** (`prefix`/`token`) — or Nounou a **son propre** chemin audio (`audioKeys`/`withVoix`).
   À réconcilier avec soin, pas à copier-coller.
5. **🟡 Le rendu de la section Sécurité** existe dans `EspaceView` → **à extraire en composant partagé**,
   sinon duplication et dette.
6. **🟡 Le câblage Nounou du geste (C4)** — `removeDest` existe, **aucun écran ne l'appelle**.

---

## 8. Périmètre — ne pas signaler comme manquant
- **C2/C4 comme questions de durcissement** → inscrits à l'**audit sécurité §7.8** (décision PO).
- **L'implémentation A7** attend la **clôture du lot Cuisine** + le **mini-lot destinataires**.
- **Conflit de fichiers confirmé** (Q&A §7) : T6 du lot Cuisine touche `PartageSheet.tsx`, épicentre du geste
  A7 ; `espace.ts` est aussi dans le périmètre T5/F5.5. **Design en parallèle : zéro risque. Implémentation :
  après.** Le séquencement ne change pas.
- **La direction visuelle** — premier essai « Riad moderne » seulement ; le lot visuel est ailleurs.

## 9. Suite
**Film mesuré** (taps réels depuis le hub pour Retirer et Ajouter ; **chiffrer D8**, le re-cochage) →
**spec §8 du lot A7** → Claude Code (read-back + chiffrage → GO → tranches → STOP → test device **foyer neuf**).

**Ordre de livraison :** clôture lot Cuisine → **mini-lot destinataires** (§5) → audit sécurité §7.8 → **lot A7**.

*Fin du readout A7 design v2.*
