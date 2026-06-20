# Menu de la semaine

Application web personnelle, **mobile-first** et **installable (PWA, hors-ligne)**, pour
composer ses menus de la semaine dans le cadre d'un programme nutritionnel.

Voir [`BRIEF_PRODUIT.md`](./BRIEF_PRODUIT.md) pour l'esprit, les objectifs et les règles métier.

## Stack

- **React + Vite + TypeScript**
- **vite-plugin-pwa** (installation mobile + offline)
- **IndexedDB** (`idb`) comme source de vérité locale — _offline-first_
- **zustand** pour l'état
- Déploiement prévu sur **Vercel**

## Démarrer en local

```bash
npm install
npm run dev          # http://localhost:5173
```

Pour tester depuis le téléphone sur le même réseau Wi-Fi :

```bash
npm run dev -- --host
```

puis ouvrir l'URL réseau affichée depuis le téléphone.

## Autres commandes

```bash
npm run build        # build de production (dossier dist/)
npm run preview      # prévisualiser le build (PWA active)
npm run test         # tests du moteur nutritionnel
npm run typecheck    # vérification TypeScript
```

## État du projet — P0 (en cours)

Implémenté :

- ✅ **Composer** un menu 7 jours (déjeuner + dîner + extras optionnels type Creami)
- ✅ **Feux tricolores** par jour (kcal vs cible du type de jour, protéines, calcium) + moyenne semaine
- ✅ **Éléments fixes** toujours comptés (collation 195 kcal + kéfir 135 kcal)
- ✅ **Filtrage** : seules les recettes « Validé » apparaissent dans les choix
- ✅ **Vue Cuisinière** : ingrédients pesés + bouton « Copier » (texte WhatsApp/SMS)
- ✅ **Bibliothèque** : lister / ajouter / écarter / réactiver
- ✅ **Persistance** automatique (IndexedDB)
- ✅ **Mobile-first** (bottom-sheet, onglets, gros boutons) + PWA minimale

À venir (P1) : synchro **Supabase** (téléphone + ordinateur), PWA installable soignée,
multi-semaines, liste de courses, fiches recette détaillées.

## Prochaine étape : synchro multi-appareils (Supabase)

L'architecture est _local-first_ : IndexedDB reste la source de vérité, la synchro viendra
se réconcilier par-dessus. Pour l'activer il faudra créer un projet Supabase gratuit et
renseigner deux variables d'environnement (voir [`.env.example`](./.env.example)).
