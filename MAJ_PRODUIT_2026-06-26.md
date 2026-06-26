# MAJ Produit — depuis Claude Code → chat Produit (2026-06-26)

> But : mettre le chat Produit à jour sur l'**état réel** de l'app après la refonte
> Cuisine, et lister ce que le **manifeste produit** devrait intégrer/trancher.
> Source de vérité technique : `DEVLOG.md` (ADR 1-31). Ce doc en est le résumé produit.

---

## 1. État en un coup d'œil

- **App en production** : https://diasporabookproject-cpu.github.io/Heath/ (PWA mobile-first, offline).
- **La refonte Cuisine du brief (fiches FC1→FC10) est livrée à 100 %, déployée et testée.**
- **Navigation actuelle** : 2 modules en bas → **Cuisine** · **Sécurité**.
  - Le module **Cuisine** = une section avec segmented control **Semaine · Recettes · Courses**, plus une action **Partager** dans l'en-tête.
  - L'ancien onglet « Cuisinière » a été **supprimé** (devenu redondant : la note vocale est dans la fiche, l'aperçu et l'envoi sont dans « Partager »).
- **Backend** : Supabase (auth lien magique, table `espaces`, bucket `shared`, edge function `generate-recipe`). IA opérationnelle (génération, estimation macros, traduction darija) en **sortie structurée garantie (tool use)**.

---

## 2. Ce qui marche réellement, fiche par fiche

| Fiche | Capacité | Statut |
|---|---|---|
| FC1 | Nav module (segmented), FAB sur Recettes, état conservé | ✅ |
| FC2 | Vue Semaine : 7 jours, socle fixe, jauge + statut en clair, ⚙ type de jour, 🔒 verrou, ⤧ remplacer, ⇄ **changer pour une recette précise**, bandeau « à valider » | ✅ |
| FC3 | Sélecteur (validées du bon type, recherche, filtre Calcium champion) | ✅ |
| FC4 | Générateur de semaine **hybride** (bibliothèque d'abord, puis complétion IA), respecte 🔒, critères, plafond d'appels IA | ✅ |
| FC5 | Bibliothèque : recherche, filtres, statuts (✦ À valider / Validé), calcium, vocal | ✅ |
| FC6 | Ajout : **Saisir / Générer IA / Importer JSON** ; macros **calculées, jamais saisies** | ✅ |
| FC7 | Fiche : détail, édition, validation, étapes, **note vocale** (voix employeur) ; calcium en safran | ✅ |
| FC8 | Courses : par rayon, **×personnes**, cochage, partage (WhatsApp/copie) | ✅ |
| FC9 | Envoi : **un seul geste** = met l'espace à jour **+ rappel WhatsApp** ; aperçu ; accusé de lecture | ✅ |
| FC10 | Espace cuisinière : projection cuisine (zéro macro/feu), **voix héros**, FR/الدارجة RTL, hors-ligne, ouverture loggée | ✅ |

---

## 3. Décisions prises pendant le build (à refléter dans le manifeste)

Ces choix concrétisent — et parfois précisent — l'esprit du brief :

1. **« À valider » = un statut, pas une corbeille.** Tout contenu IA (recette ou semaine générée) **naît « À valider »** (violet). Rien n'entre dans la bibliothèque validée sans **action explicite**. Implémenté en réutilisant le statut existant `Test`.
2. **Macros jamais saisies à la main.** Elles sont **calculées** : base nutritionnelle locale (offline, calcium soigné) **+ estimation IA** quand on est en ligne ; repli automatique, **jamais bloquant**. Toujours affichées « estimées · à valider ».
3. **Calcium : visible là où on décide.** Uniquement dans le **sélecteur** et la **fiche** (cellule safran). **Absent** de la carte-jour et du résumé hebdo (conforme à l'arbitrage UX).
4. **Projection « cuisine ».** Côté destinataire : **aucune** nutrition (kcal/calcium/feu). Seulement quoi faire + comment + **la voix**.
5. **La voix est le canal de référence.** Note vocale = **voix de l'employeur, jamais synthétisée**. Le texte traduit est du confort.
6. **Traduction darija figée à l'envoi.** Faite côté serveur **au moment de l'envoi** et **stockée dans l'espace** → lisible **hors-ligne** par la cuisinière. Repli français si indisponible.
7. **« Un seul geste » d'envoi = espace + WhatsApp.** ⚠️ Limite technique : le web ne peut **pas envoyer automatiquement** un WhatsApp ; on ouvre un **lien `wa.me` pré-rempli** (le destinataire valide l'envoi). Le « plancher » garanti = l'espace mis à jour + ce lien pré-rempli.
8. **Accusé de lecture** = log d'ouverture de l'espace (« Dernier accès »), via une petite table dédiée.
9. **Navigation produit resserrée** : Cuisine + Sécurité. Le « partage » est une **action transverse** (depuis l'en-tête), pas un onglet.

---

## 4. Architecture (rappel court, pour cadrer la faisabilité)

- **Local-first** : IndexedDB = source de vérité (recettes, semaine, destinataires, sécurité, audios). Pas encore de synchro multi-appareils.
- **Espace par destinataire** = lien capability `#e=<token>` (lecture publique, révocable), contenu **figé** dans la table `espaces` (mise à jour en place à chaque envoi). Audios dans le bucket public `shared`.
- **IA = edge functions** (clé serveur). Une seule fonction `generate-recipe`, 3 modes (génération / estimation macros / traduction), **tool use** = sortie structurée fiable.
- **Design system** repris des maquettes (pétrole/safran/violet, Fraunces/Hanken/JetBrains Mono/Noto Naskh Arabic).

---

## 5. Limites & dette connues (le manifeste doit en tenir compte)

- **« Quelle brique pour qui » pas encore granulaire** : aujourd'hui un espace = menu **+** fiches Sécurité assignées. Pas encore moyen de dire « la nounou reçoit la Sécurité **sans** le menu ». *(prochain candidat)*
- **Une seule semaine** : pas de navigation multi-semaines / historique.
- **Pas de synchro multi-appareils** : destinataires & référentiels sont locaux à l'appareil.
- **WhatsApp** = lien pré-rempli, pas d'envoi automatique (cf. §3.7).
- **Coût IA** à surveiller si diffusion élargie (génération + estimation + traduction = appels LLM).
- **Module Sécurité** encore au style v1 (cosmétique) ; **Entretien maison** non commencé.
- **Retour du personnel (« fait »)** : hors périmètre (espace en lecture seule).

---

## 6. Décisions produit à trancher (entrées pour le manifeste)

1. **Modèle « briques par personne »** : confirmer qu'on veut un choix explicite menu / sécurité / (futur entretien) par destinataire.
2. **Multi-semaines & historique** : nécessaire pour le vrai produit ? quand ?
3. **Synchro multi-appareils** (RLS par `user_id`) : priorité ? impacte la bascule POC → produit scalable.
4. **Crédibilité nutritionnelle** : jusqu'où pousser la base calcium (enjeu médical n°1) vs estimation IA ? (garde-fou actuel : « estimé », édition possible).
5. **Diffusion élargie de l'IA** : budget/quotas, modèle, garde-fous coût.
6. **Prochain module** : Entretien maison vs approfondissement Cuisine/Sécurité.

---

## 7. Ce qu'on te demande (chat Produit)

Mets à jour le **manifeste produit** pour :
- acter les **décisions §3** (statut à valider, auto-macros, calcium ciblé, projection cuisine, voix de référence, traduction figée, un-geste-WhatsApp, accusé de lecture, nav resserrée) ;
- intégrer les **limites §5** comme contraintes assumées du POC ;
- trancher les **questions §6** et en faire le prochain backlog priorisé.

> Détail technique complet et journal : `DEVLOG.md` (ADR 1-31, sessions 1-5).
