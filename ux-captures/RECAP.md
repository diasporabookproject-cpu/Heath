# RECAP — Re-capture UX pour le chantier « Simplicité & fluidité » (passe 1)

**Branche `ux-captures-v1` · base `claude/jolly-wozniak-s83str` post-F4-bis · 2026-07-12**
Matériau de chantier — **PAS de merge**. Remplace l'inventaire `screens-inventory/` (périmé, pré-FTUE).
Organisé par **volets d'analyse** (les problèmes n'ont pas tous la même nature), pas par zone.

> **Doctrine du chantier (PO)** : « **par défaut simple, paramétrage au rang 2** ». Chaque volet
> ci-dessous se lit à travers ce filtre : qu'est-ce qui pourrait devenir un DÉFAUT, et qu'est-ce
> qui pourrait se replier au rang 2 ?

## Méthode de capture
- App **RÉELLE** post-lot : build prod local (`BASE_PATH=/Heath/`, clés publiques prod) + `vite preview`,
  piloté par Playwright (viewport **390×844 @2x**), harnais repris des smokes.
- **Lecture seule sur `src/`** : seuls les scripts de capture (`ux-captures/_scripts/*.mjs`, lib partagée
  `_scripts/lib.mjs`) ont été écrits. Aucune modification produit.
- Données **réelles post-lot** : la FTUE peuple (collection « Fonds de départ » 30 recettes, destinataires
  nommés « Fatima »/« Khadija ») — **ni Khadija-seed, ni lorem**.
- Volet A = **films joués** (chaque état numéroté + `METRIQUES.md` : écrans · taps · décisions).
  Volet B = **profondeur** (états + `INNERTEXT`). Volet C = **transversal** (+ `INVENTAIRE.md`).

## ⚠️ Ce qui a résisté à la capture automatisée (règle « jamais la prod »)
- **Auth réelle** (volet « Sécuriser » de A1/A2, état CONNECTÉ de la feuille Compte B3) : l'OTP
  envoie un e-mail via le backend **prod** — non joué. On capture le volet Sécuriser (étape e-mail)
  et l'état déconnecté ; la suite (code → « Envoyé ✓ », actions connecté) est **à compléter à la
  main sur staging** avec le compte smoke (creds hors de l'env de capture).
- **Compte smoke staging** : `SEED_SMOKE_EMAIL`/`PASSWORD` + URL/clés staging absents de l'env —
  aucun parcours authentifié réel joué. Aucune capture n'a touché la prod.

---

## Volet A — les flux (films)

| Flux | Écrans | Taps | Décisions | Constat-clé pour la doctrine |
|---|---|---|---|---|
| **A1** première page | ~10 | 17 | 7 | Beaucoup de décisions AVANT d'avoir une page à soi ; nommage prénom+langue déjà « Plus tard »-able |
| **A2** envoi/partage | — | — | — | **3 paliers avant d'envoyer** : « ＋ Ajouter une personne » → formulaire (nom/rôle/langue/tél) → vue envoi (4 portées + rappel + aperçu) |
| **A3** composer un repas | — | — | 5 | 3 briques (plat/entrée/acc) + objectif kcal + nb personnes ; le plat seul suffit → entrée/acc repliables |
| **A4** jour vs semaine | — | — | — | « Partager un jour » **existe** mais seulement en rang 2 (portée « Un jour… ») ; pas de « partager ce jour » depuis la carte-jour |
| **A5** Nounou page blanche | — | — | — | Parcours le PLUS lourd : journée/conduites/urgence tous vides, N formulaires depuis rien |
| **A6** bibliothèque | — | — | — | Mode manuel = ~8 champs nutritionnels d'emblée (calculables) ; 4 modes d'ajout hétérogènes |
| **A7** turnover | 4 | — | — | **La thèse produit est tenue… mais IMPLICITE** (voir ci-dessous) |

*(Compteurs détaillés dans chaque `A*/METRIQUES.md`.)*

### Les 3 frictions PO, matérialisées
- **« Trop de menus/options/choix » (A2)** : avant d'envoyer, l'app demande de créer une personne
  (formulaire complet) PUIS propose 4 portées + rappel + traduction + aperçu. Le défaut « La semaine »
  est bon ; le reste est du rang 2 candidat au repli sous « Options ».
- **« Critères trop complexes » (A3)** : le composeur expose entrée + accompagnement + objectif kcal
  au même niveau que le plat, alors que le plat seul produit un repas valide.
- **« Vues calendrier lourdes » (A4)** : le grain « jour » n'est accessible qu'en changeant la portée
  du partage — pas de vue/action « ce jour » directe.

### A7 — le parcours-thèse (le plus important)
**La promesse « la page survit au départ, le nouveau hérite d'une page prête » est techniquement
tenue — via le RENOMMAGE d'un destinataire** (« Changer » → éditer → changer le prénom + la langue).
Le token (donc le lien permanent) ne change pas : la page et son contenu restent, la remplaçante
hérite. **MAIS ce n'est jamais énoncé** : aucun geste « [Personne] est partie → confier sa page ».
L'alternative supprimer/recréer casserait le lien (nouveau token → ancien lien mort — lié au finding
backlog `revokeEspace` silencieux). → **Chantier : matérialiser explicitement le turnover** et le
dire à l'utilisateur. C'est LE différenciateur produit, aujourd'hui caché dans un « Modifier ».

---

## Volet B — les lieux (profondeur)

- **B1 accueil** (`INNERTEXT.md`) : états foyer neuf (cartes de rôle vides) vs rempli (menu du jour,
  prochain événement). L'innerText réel est exporté pour juger la hiérarchie contre le verdict PO
  « ne fonctionne pas » (quelle action principale ? quel bruit ?).
- **B2 sécurité** : langage visuel **LEGACY** (`lib-item`/`card`/`btn--ghost`) vs le bento `mz-`/`cz-`
  de Maison/Cuisine (captures côte à côte `bento-maison`/`bento-cuisine`). États : vide (import) ·
  rempli (fiches Test) · fiche (FR+darija). Confirme « legacy à repenser ».
- **B3 compte & accès** : état déconnecté capturé (`INNERTEXT-deconnecte.md`) ; état connecté
  inventorié depuis le code (non jouable sans backend). **TROU FONCTIONNEL TRACÉ (rien inventé)** :
  **il n'existe aucune UI pour VOIR la liste des membres du foyer ni RETIRER l'accès d'un membre.**
  Le foyer partagé se gère par invitation (code) + départ volontaire uniquement. C'est la friction PO
  « consulter/modifier qui a accès » — sans réponse produit aujourd'hui. *(Plan premium : hors capture,
  parking monétisation.)*

---

## Volet C — le système IA (`INVENTAIRE.md`)
L'IA apparaît à **≥4 endroits** (Générer la semaine [plein + garde-fou vide] · composeur · ajout de
recette « Coup de main IA » · FTUE), avec des promesses et un conditionnement (connexion + quota)
**hétérogènes**. Le réglage/quota IA vit dans Compte (état connecté, non capturé). → Candidat doctrine :
un **langage IA unifié** (même verbe, même promesse, même façon de dire « connecte-toi / quota »),
paramétrage au rang 2. Détail par point dans `C-systeme-ia/INVENTAIRE.md`.

---

## Index des livrables
```
ux-captures/
  A-flux/A1-premiere-page/        17 états + METRIQUES   (film de référence, jusqu'au volet Sécuriser)
  A-flux/A2-envoi/                7 états + METRIQUES    (3 paliers + toutes les options)
  A-flux/A3-composer-repas/       4 états + METRIQUES
  A-flux/A4-grain-jour-semaine/   4 états + METRIQUES
  A-flux/A5-nounou-page-blanche/  5 états + METRIQUES    (états vides EXACTS)
  A-flux/A6-bibliotheque-recettes/7 états + METRIQUES    (4 modes + modifier + organiser)
  A-flux/A7-turnover.../          4 états + METRIQUES    (le parcours-thèse)
  B-lieux/B1-accueil/             2 états + INNERTEXT + METRIQUES
  B-lieux/B2-securite/            5 états + METRIQUES    (legacy vs bento)
  B-lieux/B3-compte-et-acces/     1 état  + INNERTEXT + METRIQUES  (trou membres tracé)
  C-systeme-ia/                   6 états + INVENTAIRE + METRIQUES
  _scripts/                       lib.mjs + un script par volet (rejouables)
```
**Rejouer** : `BASE_PATH=/Heath/ + clés publiques` → `npm run build` → `vite preview --base /Heath/`
→ `BASE_URL=http://localhost:4173/Heath/ node ux-captures/_scripts/<X>.mjs`.

## Synthèse pour ouvrir la passe 1
1. **A7 turnover** : rendre explicite le geste « remplacer une personne » (thèse produit cachée).
2. **A2/A3/A4** : appliquer « défaut simple / rang 2 » — replier options d'envoi, entrée/acc du
   composeur, exposer un grain « jour ».
3. **A5 Nounou** : un démarrage guidé contre la page blanche.
4. **B3** : décider si « voir/gérer les membres du foyer » entre au périmètre (trou actuel).
5. **B2 sécurité** + **C IA** : unifier le langage (visuel pour Sécurité, verbal pour l'IA).
