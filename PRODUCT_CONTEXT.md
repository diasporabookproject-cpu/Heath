# Contexte produit & passation — « Menu de la semaine »

> **À quoi sert ce document.** Le copier-coller (en entier) dans un **chat Claude
> dédié à la réflexion produit**. Il décrit la vision, l'utilisateur, l'état réel
> de l'application (un POC fonctionnel et déployé), l'architecture, et surtout
> **ce qui est faisable rapidement vs coûteux**, pour que la réflexion reste
> ancrée dans le réel.
>
> **Source de vérité.** Ce fichier vit dans le dépôt. Une idée discutée dans le
> chat produit ne devient une **décision** que lorsqu'elle est écrite ici (section
> « Décisions produit ») ou dans `DEVLOG.md`. Le texte collé dans le chat = une
> copie de ce fichier.

---

## 0. Comment travailler (la boucle)

Deux interlocuteurs, deux rôles :
- **Chat produit** (celui-ci) : vision, fonctionnalités, priorités, arbitrages. Ne voit pas le code ni l'app en direct.
- **Claude Code** (l'autre fil) : a le code, les tests, le déploiement. Sait chiffrer (rapide/moyen/lourd) et implémente.

**Boucle recommandée :**
1. Le chat produit propose/affine une fonctionnalité → produit une **fiche de décision** (format en §8).
2. Tu colles cette fiche à Claude Code.
3. Claude Code chiffre, implémente, déploie, et renvoie un **résultat réel** (lien de prod, capture, limites).
4. Claude Code consigne dans `DEVLOG.md`.
5. Retour au chat produit avec le résultat → on itère.

---

## 1. Le produit en une phrase

Une app web **mobile-first, installable, fonctionnant hors-ligne** qui permet à
une personne suivant un programme nutritionnel strict de **composer ses menus de
la semaine**, de **vérifier en un coup d'œil l'équilibre nutritionnel** de chaque
journée, et de **transmettre des instructions claires à la personne qui cuisine**.

Ce n'est **pas** une app grand public de comptage de calories : c'est un outil
**personnel**, taillé pour un protocole précis, avec un recueil de recettes maîtrisé.

## 2. L'utilisateur et l'esprit

- **Un seul utilisateur** (pas de comptes multiples au départ). Usage principal : **téléphone** ; appoint : ordinateur.
- Une **cuisinière à domicile** prépare les repas → elle reçoit des instructions (elle **n'utilise pas l'app**).
- Esprit : **simplicité** (composer un menu en 2-3 min au pouce), **feedback visuel immédiat**, **zéro friction de maintenance**, **orienté action** (produit quelque chose d'utile : instructions à envoyer / liens).

## 3. Contraintes dures (à ne jamais oublier)

**Médicales / métier :**
- **100 % sans gluten** (cœliaque) — ne jamais suggérer d'ingrédient gluten.
- **Calcium = enjeu n°1** (ostéopénie) → visible partout, par recette et par jour.
- **Glucides maîtrisés** (suspicion pré-diabète).
- **Cibles caloriques modulées par type de jour** : Repos 1720 / Cardio 1880 / Muscu 1950.
- Chaque jour compte **toujours** une **collation fixe** (195 kcal · 14P · 3G · 14L · 275Ca) + un **kéfir du coucher** (135 kcal · 5P · 6G · 0L · 325Ca), en plus du déjeuner et du dîner.
- **Feux tricolores** : kcal (±10 % vert / ±20 % orange / au-delà rouge), protéines (≥150 vert / 130-150 orange / <130 rouge), calcium (≥1000 vert / 850-1000 orange / <850 rouge).
- Ne **pas** « normaliser » les mesures à la cuillère (càc/càs).
- Seules les recettes « Validé » apparaissent dans les choix ; « Écarté » = archivé.

**Techniques (impactent fortement la faisabilité) :**
- **Offline-first** : l'app doit marcher sans réseau. Les données vivent d'abord **sur l'appareil** (IndexedDB).
- **Hébergement statique** (GitHub Pages) : pas de serveur applicatif maison. Le seul « backend » est **Supabase** (base de données, stockage de fichiers, authentification). Toute logique côté serveur lourde nécessiterait des *edge functions* (possible mais coûteux).
- **La cuisinière n'a pas l'app** → toute sortie pour elle doit être **partageable** (lien web, copier-coller WhatsApp, ou impression).
- **Données personnelles / médicales** : prudence sur ce qu'on héberge publiquement.
- **UI en français** ; vue cuisinière disponible en **darija (lettres arabes)**.

## 4. État réel du POC (ce qui existe et marche aujourd'hui)

🔗 **App en production** : https://diasporabookproject-cpu.github.io/Heath/

Fonctionnalités opérationnelles :
- **Composer** un menu 7 jours : déjeuner + dîner + extras optionnels (ex. dessert « Creami »), sélecteur filtré par type, recherche.
- **Feedback nutritionnel** : totaux par jour avec **feux tricolores** + **moyenne de la semaine** ; calcium mis en avant ; éléments fixes (collation + kéfir) toujours comptés.
- **Vue Cuisinière** : ingrédients pesés par repas, **bascule Français / الدارجة** (darija en lettres arabes, de droite à gauche), bouton **Copier** (texte WhatsApp).
- **Liste de courses** (onglet Courses) : agrégée automatiquement depuis le menu, regroupée par rayon, cases à cocher, bouton Copier.
- **Bibliothèque de recettes** : lister, **ajouter**, **éditer** (dont le type), **écarter/réactiver**, **importer en lot (JSON)** ; ~24 recettes traduites en darija.
- **Notes vocales** par recette : enregistrement micro, réécoute, intégrées au partage.
- **Partage du menu à la cuisinière** : **un lien court** ouvrant une **page web en lecture seule** (menu FR/darija + **lecture des notes vocales ▶️**). La cuisinière n'installe rien.
- **Compte** (optionnel) : connexion par **lien magique e-mail** (Supabase). Sert à sécuriser l'hébergement des notes vocales (et, à terme, la synchro).
- **PWA** installable, mises à jour automatiques.

Pas encore fait : **synchro multi-appareils** (les menus/recettes sont pour l'instant **locaux à l'appareil**), **fiches recette détaillées** (techniques de cuisson/dressage), et les conforts P2 (voir backlog).

## 5. Architecture (en clair, pour raisonner juste)

- **Local-first** : la base **IndexedDB** sur l'appareil est la **source de vérité**. L'app fonctionne entièrement hors-ligne.
- **Stack** : React + Vite + TypeScript, PWA. Hébergée en statique sur GitHub Pages (déploiement automatique à chaque modification).
- **Partage par lien** : le menu peut être (a) **encodé dans l'URL** (hors-ligne, sans audio) ou (b) **publié** sur Supabase (lien court, avec audios jouables). La page cuisinière est une vue **lecture seule** de l'app.
- **Backend Supabase** : authentification (lien magique), **stockage des notes vocales** (lecture publique via lien, écriture réservée à l'utilisateur connecté).
- **Tests** : logique métier (calculs, feux, liste de courses, partage) couverte par des tests ; un parcours bout-en-bout automatisé.

## 6. Faisabilité — barème indicatif

> Pour calibrer les idées. Ordres de grandeur, pas des engagements.

**🟢 Rapide (≈ ≤ 2 h)** — souvent « pur front », pas de nouvelle infra :
- Nouveaux champs sur une recette, nouvelles règles d'affichage, ajustements de seuils/feux, textes, petites vues, nouveaux formats de copie/export texte, réglages d'ergonomie, filtres/tri.

**🟡 Moyen (≈ ½ à 1-2 j)** — logique métier + UI, sans dépendance externe lourde :
- Multi-semaines / historique de menus, **fiches recette détaillées**, **repas verrouillés** (récurrents), **export PDF / impression**, récap calcium hebdo, détection de répétitions, améliorations du parseur de liste de courses, modèles de menus réutilisables.

**🔴 Lourd / à challenger (plusieurs jours, risque ou coût) :**
- **Synchro bidirectionnelle multi-appareils** (fusion de données), **multi-utilisateurs / partage avec un coach**, **temps réel collaboratif**, **notifications push**, **intégration d'API nutritionnelle externe**, **scan/OCR d'étiquettes**, **suggestion de menus par IA**, calculs côté serveur (edge functions).

Règles d'or de faisabilité : *tout ce qui reste sur l'appareil et affiche/transforme des données existantes = rapide ; tout ce qui synchronise, partage en écriture, ou fait appel à un service externe = plus lourd.*

## 7. Backlog ouvert (point de départ, à challenger)

**P1 (importantes, déjà cadrées) :**
- Synchro multi-appareils (téléphone ↔ ordinateur).
- Fiches recette détaillées (techniques, dressage), imprimables.

**P2 (confort) :**
- Repas verrouillés (ex. « Lundi déj = Kefta froide »).
- Export PDF / impression du menu + liste de courses.
- Détection de répétitions dans la semaine.
- Récap visuel du calcium hebdo.

**Idées en suspens / à explorer (issues de nos échanges) :**
- Notes vocales : aller plus loin (par jour ? par étape de recette ?).
- Page cuisinière : retour de la cuisinière (cochage « fait » ?) — attention, elle n'a pas l'app.
- Gestion des semaines passées / réutilisation de menus types.

## 8. Format d'une « fiche de décision » (à me transmettre)

Pour que Claude Code agisse sans ambiguïté, une décision devrait préciser :

```
TITRE : (ex. « Repas verrouillés »)
OBJECTIF / POURQUOI : à quel besoin ça répond, pour qui.
COMPORTEMENT ATTENDU : ce que l'utilisateur fait et voit, étape par étape.
OÙ : quel(s) onglet(s)/vue(s).
RÈGLES MÉTIER : seuils, formats, cas particuliers, contraintes médicales concernées.
CAS LIMITES : quoi faire si vide / conflit / hors-ligne / non connecté.
CRITÈRE DE « FINI » : comment on saura que c'est réussi (test concret).
PRIORITÉ : maintenant / bientôt / plus tard.
```

## 9. Questions ouvertes à trancher en priorité (produit)

Ces réponses orientent fortement l'effort technique :
1. **Synchro multi-appareils : indispensable ou confort ?** (gros investissement) Ou un seul appareil suffit-il ?
2. **Multi-utilisateurs un jour ?** (ex. partager avec un nutritionniste/coach) — ou rester strictement perso ?
3. **La cuisinière doit-elle juste consulter, ou interagir** (confirmer, signaler un manque) ? (elle n'a pas l'app → impacte le mode de partage)
4. **Ambition des fiches recette** : texte seul / photos / vidéos ?
5. **Périmètre** : rester « composition de menus » ou élargir au **suivi** (poids, mesures, adhérence) ?
6. **Multi-semaines / historique** : à quel point est-ce important au quotidien ?

## 10. Repères utiles

- Brief produit d'origine : `BRIEF_PRODUIT.md` (dans le dépôt).
- Journal technique & décisions d'archi : `DEVLOG.md`.
- Modèle pour générer des recettes importables : `TEMPLATE_RECETTE.md`.
- Lien de prod : https://diasporabookproject-cpu.github.io/Heath/

---

## Décisions produit (à remplir au fil de l'eau)

> Chaque décision validée dans le chat produit est recopiée ici (date · décision · pourquoi).
> _(vide pour l'instant)_
