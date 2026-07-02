# Plan d'action — Maison OS

> Suite à l'audit de revue (qualité code / UX / produit). Format : lots autonomes,
> chacun livrable et validable seul. Effort : **S** ≤ ½j · **M** ~1j · **L** ~2j+.
> Priorité : **P0** (à faire) · **P1** (important) · **P2** (quand on peut).
> Méthode inchangée : un lot = un lien de test + une entrée DEVLOG + validation avant le suivant.

---

## Objectif

Passer d'un produit **riche mais fragile (mono-appareil, silos)** à un produit **durable et
cohérent**, sans dévier de la mission : *centraliser le savoir du foyer et le transmettre à
ceux qui font tourner la maison.*

## Principes directeurs

1. **Ne rien perdre.** Les données du foyer doivent survivre à un changement de téléphone.
2. **Une source unique par concept** (le foyer, les enfants, le personnel) — pas de double saisie.
3. **Ce qu'on partage est scopé et confidentiel** — un destinataire ne reçoit que ce qui le concerne.
4. **On élargit par « pages par rôle »** (Cuisine, Nounou, Entretien) sur le même socle.

---

## PHASE 0 — Quick wins (correctifs sûrs, ~1 j au total)

Sans risque, à grouper en un seul passage.

- **QW1 · Scoper la map de traductions (fuite de confidentialité)** — P0 · S
  `partage.ts` : `activeTranslations` est calculé sur le document complet → le payload public
  contient les traductions de données d'enfants **non scopés**. Le restreindre au document scopé.
  *Fini :* le JSON publié d'un destinataire limité à l'enfant A ne contient plus aucune donnée de B.

- **QW2 · Renommer l'app** — P0 · S
  `vite.config.ts` : manifest encore « Menu de la semaine / Menu » → « Maison OS ».
  *Fini :* l'icône installée et l'écran de démarrage affichent « Maison OS ».

- **QW3 · Exposer la révocation de lien côté Nounou** — P1 · S
  `revokeEspace` existe mais n'est branchée que côté Cuisine. L'ajouter au partage Nounou.
  *Fini :* on peut couper un lien nounou ; le lien révoqué n'affiche plus rien.

- **QW4 · Nettoyage code mort** — P1 · S
  Supprimer `previewNounouEspace` (jamais appelé) ou le brancher via QW6.
  *Fini :* aucun export mort ; `tsc` + tests verts.

---

## PHASE 1 — Robustesse (fiabiliser l'existant)

- **R1 · Voix hors-ligne (service worker)** — P0 · M
  `vite.config.ts` : ajouter un `runtimeCaching` (CacheFirst) sur le domaine Supabase Storage
  pour que les consignes vocales soient jouables **hors-ligne** sur la page reçue (exigence FN2.2).
  *Fini :* une consigne vocale ouverte une fois reste audible en mode avion.

- **R2 · Aperçu « ce que voit la nounou »** — P1 · M (répond aussi à un manque UX)
  Brancher un bouton **Aperçu** dans le partage Nounou (rendu local via `previewNounouEspace`).
  *Fini :* le parent voit la page reçue (scopée + traduite) avant d'envoyer.

- **R3 · Flux de traduction lisible** — P1 · M
  Badge d'état par destinataire (« traduction à jour / à régénérer »), et action combinée
  **« Générer et envoyer »**. Marqueur discret « traduction auto » côté reçu tant que non relu.
  *Fini :* plus besoin de deviner qu'il faut re-envoyer ; l'état de traduction est visible.

- **R4 · Tests des zones critiques non couvertes** — P1 · M
  Tests unitaires sur `buildScopedDoc` (scoping = pas de fuite), sur le partage, et **smoke
  Playwright Nounou** (compose → partage → page reçue). Aujourd'hui le smoke ne couvre que Cuisine.
  *Fini :* un test échoue si le scoping fuit ; le smoke parcourt Nounou.

---

## PHASE 2 — Structurant (les vrais déblocages)

- **S1 · Compte-coffre : sauvegarde & restauration** — P0 · L ⚠️ chantier clé
  Aujourd'hui les données **sources** (recettes, semaines, doc Nounou, personnel, sécurité) ne
  vivent qu'en IndexedDB → perdues si on change d'appareil. Étape 1 : **export / import JSON**
  manuel (rapide, sans backend). Étape 2 : **synchro du document source** dans Supabase par
  `user_id` (RLS), avec réconciliation last-write-wins.
  *Fini (étape 1) :* on exporte tout le foyer dans un fichier et on le restaure sur un autre appareil.

- **S2 · Annuaire « Maison » unifié** — P0 · L
  Une source unique pour le foyer, les **enfants**, le **personnel** et les **contacts**,
  consommée par Cuisine, Nounou et Sécurité. Résout la double notion de « destinataire »
  (`Destinataire` vs `NounouDest`) et la double saisie.
  *Fini :* on saisit un enfant / une employée une seule fois ; les 3 modules la voient.

- **S3 · Trancher Sécurité ⟷ Fiche urgence** — P0 · M (dépend de S2)
  Décision produit : soit **Sécurité devient une brique** (numéros/gestes/procédures) *consommée*
  par les pages par rôle, soit on la fusionne dans les pages par rôle et on retire l'onglet.
  Objectif : **zéro redondance** entre l'onglet Sécurité et la Fiche urgence Nounou.
  *Fini :* un numéro d'urgence / une règle se saisit à un seul endroit.

- **S4 · Versioning du schéma Nounou + purge des traductions orphelines** — P2 · S
  Équivalent du `SEED_VERSION` Cuisine pour le document Nounou ; nettoyer `doc.translations`
  des entrées dont le texte source a disparu.
  *Fini :* une évolution de schéma migre proprement ; le cache de traductions ne gonfle plus.

---

## PHASE 3 — Produit (élargir en restant dans la mission)

- **P1 · « Mot de Maman » du jour** — P1 · M
  Mémo vocal quotidien en hero de la page reçue (déjà prévu, non branché).
  *Fini :* le parent enregistre un mot du jour ; la nounou l'entend en haut de sa page.

- **P2 · Tableau de bord « Aujourd'hui »** — P1 · L
  Écran d'accueil transverse : menu du jour + planning nounou + alertes, en un coup d'œil.
  Transforme 3 silos en cockpit du foyer.
  *Fini :* l'ouverture de l'app montre la journée agrégée.

- **P3 · Module Entretien (3ᵉ page par rôle)** — P2 · L
  Même primitive que Nounou pour la femme de ménage (tâches par pièce, produits, rythme,
  partage scopé). Rentabilise l'architecture « page par rôle ».
  *Fini :* on compose et on partage une page Entretien comme une page Nounou.

- **P4 · Rappels manuels** — P2 · M
  Bouton « envoyer le rappel du jour » (WhatsApp/notification), **manuel** d'abord (pas d'API
  WhatsApp Business). Reste hors-MVP tant que non prioritaire.
  *Fini :* un tap envoie un résumé + lien du jour au destinataire.

---

## Séquencement recommandé

1. **Phase 0** en un passage (sûr, visible, corrige la fuite).
2. **R1 + R4** (offline audio + tests scoping) — fiabilise avant d'élargir.
3. **S1 étape 1 (export/import)** — filet de sécurité contre la perte de données, sans backend.
4. **S2 + S3** ensemble (annuaire unifié + trancher Sécurité) — le grand nettoyage de cohérence.
5. **R2 + R3** (aperçu + traduction lisible) — polissage UX du partage.
6. **Phase 3** selon l'appétit produit ; commencer par **« Mot de Maman »** (fort, peu coûteux).

## Ce qui reste explicitement hors périmètre

Flux ICS exposé · automatisation WhatsApp (API Business) · bascule de langue côté employé ·
création de contenu côté employé · vidéo.

---

*Prochaine étape : choisir le point de départ. Recommandation — **Phase 0** (rapide et sûr),
puis décider entre le chantier « données » (S1) et le chantier « cohérence » (S2+S3).*
