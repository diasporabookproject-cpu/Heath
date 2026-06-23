# Contexte produit & passation — « Maison OS » (nom de travail)

> **À quoi sert ce document.** Le copier-coller (en entier) dans un **chat Claude
> dédié à la réflexion produit**. Il décrit la vision, les utilisateurs, les
> contraintes, l'état réel de ce qui est déjà construit (un POC du module Cuisine,
> déployé et fonctionnel), et **ce qui est faisable rapidement vs coûteux**.
>
> **Source de vérité.** Ce fichier vit dans le dépôt. Une idée discutée dans le
> chat produit ne devient une **décision** que lorsqu'elle est écrite ici (section
> « Décisions produit ») ou dans `DEVLOG.md`.
>
> **Historique.** Le projet a démarré comme une app **perso de menus de la semaine**
> (voir `BRIEF_PRODUIT.md`, toujours valable pour le détail du module Cuisine). La
> vision a été élargie : ce n'est plus une app de menus, mais une **app de gestion
> de la maison et de briefing du personnel**, dont la cuisine est le **premier module**.

---

## 0. Comment travailler (la boucle)

- **Chat produit** (celui-ci) : vision, fonctionnalités, priorités, arbitrages. Ne voit pas le code ni l'app en direct.
- **Claude Code** (autre fil) : a le code, les tests, le déploiement. Sait chiffrer (🟢 rapide / 🟡 moyen / 🔴 lourd) et implémente.

**Boucle :** le chat produit produit une **fiche de décision** (format §8) → tu la colles à Claude Code → il chiffre, implémente, déploie, renvoie un **résultat réel** (lien, capture, limites) → il consigne dans `DEVLOG.md` → retour au chat produit.

---

## 1. La vision

**Centraliser le savoir d'un foyer, le mémoriser, et le transmettre aux bonnes
personnes (le personnel de maison), de façon claire et actionnable.**

Le propriétaire (l'« administrateur du foyer ») détient un savoir : comment on
mange ici, comment on entretient la maison, comment on s'occupe des enfants et de
la sécurité. Aujourd'hui ce savoir est dans sa tête, éparpillé (WhatsApp, oral,
fichiers). L'app le **structure une fois**, le **garde en mémoire**, et le
**transmet** au bon membre du personnel — y compris à des gens qui **n'utilisent
pas l'app** et qui parlent **darija**.

Ce n'est **pas** une app grand public. C'est l'**« OS de la maison »** d'un foyer
avec du personnel : un référentiel privé + un outil de briefing.

## 1.b Nos décisions & principe d'évolutivité

**On va prendre ensemble plusieurs types de décisions** (et chacune sera **testée
avec Claude Code**, qui implémente et déploie un résultat réel) :
- **Commerciales / stratégiques** : cible, positionnement, périmètre, perso vs futur
  produit pour d'autres foyers, modèle économique éventuel, priorités.
- **Fonctionnelles** : quelles fonctionnalités, pour quel module, pour qui.
- **Techniques** : architecture, modèle de données, choix de briques, scalabilité.
  Le chat produit peut **proposer** une direction technique ; on la **valide avec
  Claude Code** (faisabilité, coût, implications).

**Principe directeur — « POC léger, mais conçu pour devenir un vrai produit » :**
- On démarre **léger et rapide** pour prototyper (l'existant est volontairement simple).
- **Mais** l'app doit pouvoir devenir à terme un **vrai produit, scalable** (plus de
  modules, plus de contenu, potentiellement plusieurs foyers/utilisateurs).
- Donc les **choix initiaux ne doivent pas créer d'impasse** : privilégier de bonnes
  séparations (le **socle générique** réutilisable, un modèle de données propre, des
  rôles/destinataires pensés tôt, pas de dépendance bloquante) **sans** sur-ingénierie
  prématurée. Quand un choix « rapide » risque de bloquer la montée en charge future,
  **le signaler explicitement** et arbitrer en connaissance de cause.

## 2. Le motif commun à tous les modules (le cœur du produit)

Chaque module suit **le même patron** — c'est ce qui fait l'unité de l'app et
permet de réutiliser les briques :

1. **Référentiel** — une bibliothèque de **fiches** structurées (une recette, une procédure de ménage, une consigne de sécurité…). Ajout manuel **ou génération assistée par IA**, édition, statut (validé / archivé), catégories.
2. **Composer / Planifier** — assembler des fiches dans un **plan** (menu hebdo, planning de ménage, planning enfants).
3. **Briefer / Transmettre** — produire une **consigne claire pour une personne** : texte + **note vocale** + **checklist** + **lien partagé** (page lecture seule, sans installer l'app) + **multilingue (français / darija en lettres arabes)** + imprimable.
4. **Mémoire** — tout est sauvegardé, réutilisable, versionnable.
5. **Destinataires / rôles** — « qui reçoit quoi » : cuisinière, femme de ménage, nounou… Chaque personne reçoit le brief qui la concerne.

> Conséquence pour la construction : on investit dans **ces briques génériques**.
> Le module Cuisine en est la 1re instance ; les modules 2 et 3 les réutilisent
> (donc deviennent nettement moins coûteux une fois les briques posées).

## 3. Utilisateurs & rôles

- **L'administrateur du foyer** (utilisateur principal) : compose, mémorise, transmet. Usage téléphone surtout, ordinateur en appoint.
- **Le personnel** (cuisinière, femme de ménage, nounou…) : **destinataires**. Ils **ne sont pas obligés d'utiliser l'app** → ils reçoivent des **liens / messages / notes vocales** (souvent en **darija**). Question ouverte : doivent-ils pouvoir **interagir** (confirmer « fait », signaler un manque) ?
- Multi-foyers / plusieurs administrateurs : hors scope au départ, à garder en tête.

## 4. Les 3 modules de départ

### Module 1 — Cuisine 🍳 *(POC déjà construit)*
Composer des menus à partir d'un référentiel de recettes, vérifier l'équilibre
nutritionnel, transmettre les instructions à la cuisinière (texte + darija + notes
vocales + lien). **C'est le module mûr** (voir §5). Évolutions possibles :
génération de recettes par IA, fiches recette détaillées (techniques, dressage), etc.

### Module 2 — Entretien maison 🧹 *(à concevoir)*
Référentiel de **procédures / tutos de ménage et d'entretien** (ex. « nettoyer
l'inox », « entretien des plantes », « lessive par type de textile »), **bonnes
pratiques** à instaurer, et **planning d'entretien** (quoi, quand, par qui).
Transmission au personnel sous forme de **briefs / checklists / tutos** (texte +
note vocale + éventuellement photos/vidéos), en darija au besoin.

### Module 3 — Enfants / Sécurité 👶🛡️ *(à concevoir)*
**Règles et planning des enfants** (routines, horaires, autorisations) et
**consignes de sécurité** (que faire en cas de…, numéros, gestes interdits/permis).
À **transmettre à la nounou / au personnel** de façon non ambiguë, mémorisée et
mise à jour. Sensibilité particulière (sécurité enfants) → clarté et fiabilité avant tout.

> Ces 3 modules sont **un point de départ**. D'autres pourraient suivre (courses/stocks,
> prestataires & contacts, budget du foyer, etc.) — à challenger dans le chat produit.

## 5. État réel de l'existant — **lot v1 livré (F1→F5)**

🔗 **App en production** : https://diasporabookproject-cpu.github.io/Heath/
📋 Détail des décisions & fiches : `PASSATION_CLAUDE_CODE.md` · journal technique : `DEVLOG.md`.

**Socle transverse (réutilisable par tous les modules) :**
- **Destinataires** (cuisinière, nounou…) avec **langue** ; **espace permanent par personne** via un **lien capability** (`#e=<jeton>`), en **lecture seule**, **hors-ligne** (cache), **dans sa langue** (RTL si darija), **mise à jour en place**, **révocable**.
- **Connexion** par lien magique e-mail ; **PWA** installable.

**Module Cuisine 🍳 :**
- Composer un menu 7 jours ; feux tricolores + moyenne semaine ; éléments fixes comptés.
- Vue Cuisinière FR/الدارجة (RTL), copier WhatsApp ; **liste de courses** par rayon.
- Bibliothèque : ajouter / éditer / écarter / **importer (JSON)** / **générer un brouillon par IA** (Claude, sortie en Test, relecture humaine) ; ~26 recettes, darija.
- **Notes vocales** par recette ; partage par lien (ponctuel ou via l'espace d'une personne).

**Module Sécurité 🛡️ :**
- Référentiel (numéros d'urgence / procédures / gestes permis-interdits) + **pack de démarrage** ; statut Test/Validé ; **note vocale du parent** ; darija.
- **Assignation par personne** → les fiches Validé apparaissent dans l'espace du destinataire (numéros en tête). **Aucune IA** sur la sécurité.

**Backend :** Supabase (auth, table `espaces` = contenu par jeton, bucket `shared` = audios en écriture connectée, **edge function** `generate-recipe` = relais Claude clé serveur).

**Dette / pas encore fait :** **synchro multi-appareils** (destinataires, recettes, fiches Sécurité sont encore **locaux à l'appareil**) ; contenu de l'espace pas encore composable par personne (le menu courant y est toujours inclus) ; QR + accusé de lecture (différés) ; modules Entretien et Enfants-planning ; fiches recette détaillées.

## 6. Contraintes

**Transverses (tous modules) :**
- **Offline-first** : marche sans réseau ; données d'abord **sur l'appareil**.
- **Hébergement statique** (GitHub Pages) ; seul backend = **Supabase** (base, stockage fichiers, auth). Logique serveur lourde = *edge functions* (coûteux).
- **Le personnel n'a pas l'app** → sorties **partageables** (lien web, WhatsApp, impression).
- **Multilingue** : UI en français ; **darija (lettres arabes)** pour le personnel.
- **Confidentialité** : données privées du foyer (et **sécurité enfants**) → prudence sur l'hébergement public.

**Spécifiques au module Cuisine (médical) :** 100 % sans gluten ; calcium = enjeu n°1 (visible partout) ; glucides maîtrisés ; cibles kcal par type de jour (Repos 1720 / Cardio 1880 / Muscu 1950) ; collation + kéfir du coucher toujours comptés ; feux tricolores (kcal ±10/20 %, protéines ≥150/130, calcium ≥1000/850) ; ne pas normaliser càc/càs.

## 7. Faisabilité — barème indicatif

> Règle d'or : *rester sur l'appareil + afficher/transformer des données = 🟢 ;
> synchroniser, partager en écriture, appeler un service externe (IA, etc.) = plus lourd.*

- **🟢 Rapide (≤ ~2 h)** : nouvelle sorte de fiche, champs, règles d'affichage, vues simples, formats de partage texte, ergonomie, filtres/tri.
- **🟡 Moyen (½ à 1-2 j)** : un **nouveau module** réutilisant les briques (référentiel + planning + brief) une fois le socle générique posé ; fiches détaillées ; checklists ; multi-semaines ; export PDF/impression ; planning par personne.
- **🔴 Lourd / à challenger (plusieurs jours, risque/coût)** : **socle générique** transverse (refactor pour rendre les briques réutilisables — investissement qui paie ensuite) ; **synchro multi-appareils** ; **multi-utilisateurs / rôles avec comptes** ; **génération IA** (intégration d'un service, coût, qualité darija à valider) ; temps réel ; notifications push ; photos/vidéos hébergées à grande échelle.

## 8. Format d'une « fiche de décision »

```
TITRE :
TYPE : (Commerciale / Fonctionnalité / Technique)
MODULE : (Cuisine / Entretien / Enfants-Sécurité / Transverse)
OBJECTIF / POURQUOI : besoin, pour qui (admin ? quel membre du personnel ?).
COMPORTEMENT ATTENDU : ce que l'utilisateur fait et voit, étape par étape.
OÙ : module / écran.
RÈGLES MÉTIER : seuils, formats, cas particuliers, contraintes concernées.
CAS LIMITES : vide / conflit / hors-ligne / non connecté / multilingue.
CRITÈRE DE « FINI » : test concret de réussite.
PRIORITÉ : maintenant / bientôt / plus tard.
```

## 9. Questions — tranchées en v1 & ouvertes pour le v2

**Tranchées pendant le v1** (cf. décisions D1-D13 dans `PASSATION_CLAUDE_CODE.md`) :
- ✅ Architecture = **socle générique commun** (Destinataire + Espace + référentiel/brief), décliné par module.
- ✅ « Qui reçoit quoi » = **assignation par personne**.
- ✅ Personnel en **lecture seule** en v1 (retour différé — D1).
- ✅ IA = recettes seulement, **humain dans la boucle**, **exclue de la Sécurité** (D9).
- ✅ Ordre : Cuisine → Sécurité → (Entretien, Enfants-planning).

**Ouvertes pour le v2 (à prioriser) :**
1. **Synchro multi-appareils** — la dette n°1 : destinataires/recettes/fiches sont locaux à l'appareil. Indispensable pour « vrai produit ». Stratégie de fusion + RLS par foyer.
2. **Contenu de l'espace composable par personne** (ex. nounou sans menu ; cuisinière sans sécurité).
3. **Compléter l'accès** (F1 différé) : QR imprimable + aide install iOS + accusé « lu/ouvert ».
4. **Module Entretien maison** (réutilise le socle).
5. **Retour du personnel** (« fait » / « manque ») — réactiver D1 ?
6. **Identité & positionnement** : nom, perso vs produit multi-foyers, modèle économique.
7. **Périmètre Sécurité/Enfants** : routines/planning enfants ; jusqu'où va la responsabilité.

## 10. Repères utiles

- Brief d'origine (détail module Cuisine) : `BRIEF_PRODUIT.md`.
- Journal technique & décisions d'archi : `DEVLOG.md`.
- Modèle de recettes importables : `TEMPLATE_RECETTE.md`.
- Lien de prod : https://diasporabookproject-cpu.github.io/Heath/

---

## Décisions produit (au fil de l'eau)

- **2026-06-23 — Lot v1 livré (F1→F5)** : socle Destinataire+Espace, Cuisine (+ IA recettes), Sécurité (assignation par personne). Décisions verrouillées D1-D13 dans `PASSATION_CLAUDE_CODE.md`. Dette assumée : pas de synchro multi-appareils (données locales).
- *(suite à remplir au fil des décisions du chat produit)*
