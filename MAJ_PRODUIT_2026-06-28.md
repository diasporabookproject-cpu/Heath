# MAJ Produit — 2026-06-28 (handoff pour le manifeste)

> Pour le chat « Produit ». Résumé de la session du 28/06. **Tout le travail du jour
> a porté sur la nouvelle page Nounou.** La page Cuisine n'a pas changé
> fonctionnellement (un seul micro-ajustement technique, sans impact produit).
> Prod : https://diasporabookproject-cpu.github.io/Heath/

---

## 1) NOUNOU — nouvelle « page par rôle » (livrée de bout en bout)

Sœur de la page Cuisine : **une page pré-remplie, transmissible à la nounou**, qu'elle
ouvre en **lecture seule, hors-ligne, dans sa langue**. Construite et déployée
intégralement aujourd'hui (brief FN0→FN5 complet).

### Côté parent (admin) — 3 onglets
- **Journée.** Vue à la journée + bande de jours navigable (semaines ‹ ›). Modèle en
  **couches** avec précédence stricte **ponctuel > période > rythme habituel** :
  - **Moments** récurrents (école, sieste, coucher…) : ajout en **un tap** (suggestions)
    ou formulaire (heure, sélecteur de jours avec raccourcis « jours d'école » = lun–ven,
    tags enfants, lieu).
  - **Périodes** (vacances, Ramadan, voyage) : un rythme alternatif sur une plage de
    dates, démarré comme **copie du rythme habituel** ajustable ; **chevauchement
    interdit** à la création.
  - **Ponctuels** : un événement sur un seul jour, par-dessus, sans modifier le rythme.
- **Conduites** (« que faire si… »). Bibliothèque de protocoles **rédigés par le parent**
  (catégories santé/sécurité/quotidien, badge Urgent), **gabarits « à compléter »**,
  **consignes vocales** (la **voix du parent, jamais synthétisée**). _Invariant tenu :
  l'app ne génère aucun conseil médical ; les modèles sont des gabarits vides._
- **Fiche urgence.** Numéros Maroc **19/15/150** « à vérifier », contacts, **règles &
  autorisations** (autorisé/interdit), **fiches enfants** (allergie en évidence,
  traitement, médecin, groupe, habitudes). Tout rédigé/confirmé par le parent.

### Transmission (le cœur)
- **Langue par destinataire** : catalogue **Français (auteur) · الدارجة · العربية ·
  English** (darija distincte de l'arabe standard), réglée dans la fiche du destinataire.
- **Un seul lien permanent, scopé** (les enfants du destinataire, son rôle, sa langue) :
  envoi **WhatsApp** pré-rempli + **QR code** (généré localement, hors-ligne) +
  **accusé de lecture** (« ouvert il y a … »). **Mise à jour en place** : on renvoie au
  même lien, la nounou n'a rien à refaire. Multi-destinataire dès le départ.
- **Page reçue** : atterrit sur aujourd'hui, bande de jours, fiche du jour + bandeau de
  période, **3 accès d'un seul niveau** (Que faire si… / Qui appeler avec **appel au
  tap** / Les enfants), **RTL + police arabe** si langue arabe, **fonctionne
  hors-ligne**. Aucune mécanique de gestion, pas de bascule de langue côté employée.

### Traduction (darija / arabe / anglais)
- **Langue d'auteur = français = source.** Les traductions sont des **artefacts dérivés,
  figés** dans le lien et **mis en cache hors-ligne**.
- **Interface (libellés fixes + dates)** traduite nativement dans l'app ; **contenu
  rédigé** traduit par une fonction IA dédiée. Résultat : la page reçue est
  **entièrement** dans la langue cible (chrome compris), pas seulement le contenu.

### ⚠️ Décision produit à intégrer au manifeste (changement de règle)
- La règle initialement **« non négociable »** — *« le sensible (santé/urgences/
  conduites/allergies) n'est diffusé dans une nouvelle langue qu'après relecture du
  parent »* — a été **assouplie à la demande d'Amine** :
  - Désormais **toute la traduction part avec le lien**, même non relue.
  - La relecture devient un **rappel non bloquant** (compteur « à relire » + rappel à
    l'envoi), avec, par item sensible, **Valider / Éditer / Rejeter**.
  - **Réversible** si on veut réactiver le verrou plus tard.
- Les autres invariants tiennent : **voix jamais synthétisée**, **personnel = lecture
  seule**, **app = véhicule des consignes du parent (jamais conseiller médical)**.

### Vocabulaire verrouillé (à conserver dans le manifeste)
**moment** (récurrent) · **ponctuel** (un jour) · **période** (plage) · **rythme
habituel** (le socle). Onglets : **Journée · Conduites · Fiche urgence** (« Repères »
banni).

### Hors-MVP (non faits, volontairement)
Flux calendrier ICS exposé · rappel WhatsApp hebdo traduit · bascule de langue côté
employée · création/édition côté employée · vidéo. Le **« Mot de Maman » du jour**
(mémo vocal quotidien en hero de la page reçue) est prévu mais **pas encore branché**.

---

## 2) CUISINE — état (inchangé fonctionnellement aujourd'hui)

Aucune évolution produit de la Cuisine ce jour. Rappel de l'état (déjà livré
précédemment, toujours en prod) : 3 repas/jour avec composants (entrée/plat/
accompagnement), objectif calorique individuel, favoris, génération IA des repas
vides, navigation multi-semaines + copie, courses par rayon ×personnes, espace
cuisinière (voix + darija + RTL), partage par lien.

- **Seul changement technique du jour, sans impact produit** : le composant de
  **consigne vocale** (enregistrement de la voix du parent) a été rendu **réutilisable**
  pour qu'il serve aussi à la page Nounou. Comportement Cuisine identique.

---

## 3) Infrastructure (rien de nouveau côté schéma)

La page Nounou **réutilise l'existant** : table `espaces` (lien capability),
`espace_opens` (accusé de lecture), bucket `shared` (audios). **Aucune nouvelle table.**
Action faite aujourd'hui : déploiement d'**une edge function** de traduction
(`generate-translation`, même clé serveur que la génération de recettes).

---

## 4) Pistes produit à arbitrer (prochaines)
- Brancher le **« Mot de Maman » du jour** (voix en hero de la page reçue).
- Filtrage fin « quelle brique pour quel destinataire » (déjà amorcé via le scoping
  enfants ; étendre éventuellement aux conduites/fiches).
- Décider si on garde la relecture du sensible **non bloquante** (actuel) ou si on
  réactive un **gate** pour certaines catégories.
- Synchro multi-appareils du document Nounou (aujourd'hui local-first par appareil,
  partagé via le lien).
