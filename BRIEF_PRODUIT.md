# BRIEF PRODUIT — Application « Menu de la semaine »

> Document à fournir à Claude Code en début de projet. Il décrit l'esprit, les objectifs, les utilisateurs et les fonctionnalités attendues. Le détail technique est volontairement ouvert : Claude Code propose la meilleure implémentation.

---

## 1. En une phrase

Une application web mobile-first (installable sur l'écran d'accueil, fonctionnant hors-ligne) qui permet à une personne suivant un programme nutritionnel strict de **composer ses menus de la semaine** à partir d'un recueil de recettes, de **vérifier en un coup d'œil l'équilibre nutritionnel** de chaque journée, et de **générer des instructions claires pour la personne qui cuisine**.

---

## 2. Le contexte et l'esprit de la démarche

L'utilisateur suit un programme de recomposition corporelle sur plusieurs mois, avec des contraintes médicales précises (maladie cœliaque → 100 % sans gluten strict, ostéopénie → cible calcium élevée, suspicion de pré-diabète → glucides maîtrisés). Il a une cuisinière à domicile qui prépare les repas selon des instructions quotidiennes.

Jusqu'ici, les menus étaient composés manuellement (échanges + documents Word + un fichier Excel). Le tableur est devenu trop lourd à maintenir (formules, listes déroulantes qui cassent sur mobile). **L'objectif de l'app est de rendre cette composition rapide, agréable et fiable, surtout depuis un téléphone.**

Esprit recherché :
- **Simplicité d'abord.** Composer un menu doit prendre 2 minutes, au pouce, sans réfléchir à de la technique.
- **Feedback visuel immédiat.** L'utilisateur veut voir tout de suite s'il sort de ses cibles (calories, calcium, protéines), pas faire des calculs.
- **Zéro friction de maintenance.** Ajouter ou retirer une recette doit être trivial. Pas de formules, pas de fichiers à re-télécharger.
- **Orienté action.** L'app produit quelque chose d'utile en sortie : des instructions à transmettre à la cuisinière (copier-coller vers WhatsApp/SMS, ou idéalement une fiche imprimable).

Ce n'est PAS une app de comptage de calories grand public. C'est un outil personnel, taillé pour un protocole précis, avec un recueil de recettes maîtrisé.

---

## 3. Utilisateur unique

Une seule personne utilise l'app (pas de comptes multi-utilisateurs, pas d'authentification nécessaire au départ). Données privées, stockées localement / sur un backend simple. L'app peut être utilisée sur téléphone (usage principal) et sur ordinateur (appoint).

---

## 4. Les objets métier

### Recette
Chaque recette a :
- un **identifiant** unique (ex. DEJ-01, DIN-05, CF-03)
- un **nom**
- un **type** : Déjeuner / Dîner / Coupe-faim
- un **statut** : Validé (utilisable) / Écarté (gardé en archive, exclu des choix) / Test
- un **jour adapté** : Tous / Repos / Sport (indicatif, aide au placement)
- des **macros par portion** : calories (kcal), protéines (g), glucides (g), lipides (g), calcium (mg)
- un **flag calcium** : Champion / Moyen / Faible (lecture rapide)
- les **ingrédients pesés** (texte structuré, une portion)
- *(à venir)* une **préparation détaillée** : étapes, technique de cuisson, assaisonnement, dressage

### Journée
- 7 jours (Lundi → Dimanche)
- chaque jour a un **type** (Repos / Muscu / Cardio) qui détermine une **cible calorique** :
  - Repos : ~1720 kcal
  - Cardio : ~1880 kcal
  - Muscu : ~1950 kcal
- chaque jour reçoit **un déjeuner + un dîner** (choisis dans le recueil)
- à chaque jour s'ajoutent **automatiquement** deux éléments fixes :
  - une **collation** standard : 195 kcal · 14 g P · 3 g C · 14 g L · 275 mg Ca
  - un **kéfir du coucher** : 135 kcal · 5 g P · 6 g C · 0 g L · 325 mg Ca

### Semaine
- un menu = 7 jours composés
- l'app peut gérer **plusieurs semaines** (semaine courante, suivantes, passées)

---

## 5. Les cibles nutritionnelles (règles de couleur)

Le cœur de l'app : un feedback visuel par **feux tricolores**.

**Calories du jour** (somme déjeuner + dîner + collation + kéfir), comparées à la cible du jour :
- 🟢 Vert : écart ≤ 10 %
- 🟡 Orange : écart 10–20 %
- 🔴 Rouge : écart > 20 %

**Protéines du jour** :
- 🟢 ≥ 150 g · 🟡 130–150 g · 🔴 < 130 g

**Calcium du jour** :
- 🟢 ≥ 1000 mg · 🟡 850–1000 mg · 🔴 < 850 mg

**Moyenne de la semaine** affichée en évidence (kcal/jour, protéines/jour, calcium/jour).

> Note : les desserts type « Creami » (glace protéinée) des soirs de sport ne sont pas comptés automatiquement. Prévoir une mention discrète (« +~90 kcal nets les soirs de Creami ») ou, mieux, une option pour ajouter un extra optionnel par jour.

---

## 6. Fonctionnalités clés (priorité)

### P0 — indispensables
1. **Composer un menu** : vue 7 jours, taper un slot (déjeuner/dîner) ouvre un sélecteur de recettes filtré par type, recherche par nom. Choix en un tap.
2. **Feedback nutritionnel** : totaux par jour avec feux tricolores ; moyenne semaine.
3. **Filtrage automatique** : seules les recettes « Validé » apparaissent dans les choix. Écarter une recette la retire des choix instantanément.
4. **Vue Cuisinière** : pour chaque jour, déjeuner + dîner avec ingrédients pesés. Bouton « Copier » (texte prêt pour WhatsApp/SMS).
5. **Bibliothèque de recettes** : lister, ajouter, écarter/réactiver une recette.
6. **Persistance** : tout est sauvegardé automatiquement (les menus et les recettes survivent à la fermeture).
7. **Mobile-first** : pensé pour le pouce, boutons larges, sélecteur en bottom-sheet. Fonctionne aussi sur desktop.

### P1 — importantes
8. **PWA installable** : « Ajouter à l'écran d'accueil », icône, fonctionne hors-ligne.
9. **Navigation multi-semaines** : composer plusieurs semaines à l'avance.
10. **Liste de courses générée** : agréger les ingrédients de la semaine en une liste (idéalement regroupée par rayon).
11. **Fiches recette détaillées** : au-delà des ingrédients, les techniques (cuisson, assaisonnement, dressage), consultables et imprimables, pour améliorer la qualité d'exécution sans toucher aux macros.

### P2 — confort
12. **Repas verrouillés** : possibilité de figer certains repas récurrents (ex. « Lundi déjeuner = Kefta froide », « Samedi déjeuner = Sandwich batbout »).
13. **Export** : menu de la semaine + liste de courses en PDF / impression.
14. **Détection de répétitions** : signaler si une recette revient trop souvent dans la semaine.
15. **Suivi calcium hebdo** : petit récap visuel du calcium sur les 7 jours (vu l'enjeu ostéopénie).

---

## 7. Contraintes et règles métier à respecter

- **100 % sans gluten** : toutes les recettes le sont déjà ; ne jamais suggérer d'ingrédient gluten. (Pas de logique à coder, mais à garder en tête si génération de contenu.)
- **Huile mesurée à la cuillère** : les ingrédients mentionnent « 1 càc / 1 càs » volontairement — ne pas « normaliser » en grammes.
- **Calcium = enjeu de premier plan** : il doit être visible partout (par recette et par jour), pas enfoui.
- **Les deux éléments fixes** (collation + kéfir) sont toujours comptés dans chaque journée.
- **Cibles modulées par type de jour** (repos/cardio/muscu) — ne pas appliquer une cible unique.

---

## 8. Stack — laissé au choix de Claude Code

Préférences (non bloquantes) :
- Quelque chose de **simple à déployer et à maintenir**, que l'utilisateur (non-développeur, mais à l'aise) puisse faire évoluer avec l'aide de Claude Code.
- **PWA** pour l'installation mobile et l'offline.
- Stockage : démarrer en **local (navigateur)** est acceptable ; si un backend léger est proposé (pour synchroniser téléphone + ordinateur), privilégier une solution simple et peu coûteuse.
- Pas de complexité inutile (pas de framework lourd si non justifié).

Claude Code est invité à **proposer** la stack et à expliquer son choix en une courte note avant de construire.

---

## 9. Données fournies

Un fichier `recettes.json` accompagne ce brief : il contient le recueil complet (17 recettes principales validées + 1 archivée + coupe-faim), au format prêt à importer. Les champs correspondent à la section 4. C'est le jeu de données de départ ; l'app doit permettre d'en ajouter d'autres.

---

## 10. Définition de « réussi »

- Depuis mon téléphone, je compose un menu de 7 jours en moins de 3 minutes.
- Je vois immédiatement quels jours sortent de mes cibles.
- Je copie les instructions cuisinière en un tap et je les envoie sur WhatsApp.
- J'ajoute une nouvelle recette en 1 minute, elle est tout de suite disponible.
- L'app est sur mon écran d'accueil et s'ouvre comme une vraie app, même sans réseau.
