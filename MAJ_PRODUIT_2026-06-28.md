# MAJ Produit — 2026-06-28 (handoff manifeste)

> Pour le chat « Produit ». **Tout le travail du jour a porté sur la nouvelle page
> Nounou** (brief FN0→FN5, livré de bout en bout). La page Cuisine n'a pas évolué
> fonctionnellement. Prod : https://diasporabookproject-cpu.github.io/Heath/

---

## A. Vue d'ensemble

La **page Nounou** est une « page par rôle », sœur de la Cuisine : le parent compose
(planning, conduites, fiche urgence), puis transmet **un lien permanent scopé** ; la
nounou ouvre une **page en lecture seule, hors-ligne, dans sa langue**.

**Statut global : MVP complet et en production.** Reste seulement des options post-MVP
(voir §F).

**Ordre de construction** (boucle de valeur d'abord) : Lot 0 → 1 → (4.1+4.3) → 5 → 2 →
3 → 4.2, puis 2 ajustements post-retours.

---

## B. Récap par lot

| Lot | Fiches | Objet | Statut |
|----|--------|-------|--------|
| **0 — Socle** | FN0.1, FN0.2 | Modèle de données en couches + coquille 3 onglets | ✅ en prod |
| **1 — Journée (admin)** | FN1.1→FN1.4 | Vue jour, moments, périodes, ponctuels | ✅ en prod |
| **4.1+4.3 — Partage** | FN4.1, FN4.3 | Langue par destinataire + lien durable scopé + QR + WhatsApp + accusé | ✅ en prod |
| **5 — Page reçue** | FN5.1 | Page nounou lecture seule, 3 accès, RTL, hors-ligne | ✅ en prod |
| **2 — Conduites** | FN2.1, FN2.2 | Protocoles rédigés par le parent + consignes vocales | ✅ en prod |
| **3 — Fiche urgence** | FN3.1 | Numéros, contacts, règles, fiches enfants | ✅ en prod |
| **4.2 — Traduction** | FN4.2 | darija/arabe/anglais + relecture du sensible | ✅ en prod |
| **+ Ajustements** | — | Relecture non bloquante + édition ; traduction complète (interface + dates) | ✅ en prod |

---

## C. Détail par lot

### Lot 0 — Socle technique
- **Modèle en couches**, précédence stricte **ponctuel > période > rythme habituel**.
- Local-first (document unique, hors-ligne), synchro via l'existant. Coquille à 3 onglets
  **Journée · Conduites · Fiche urgence** + action Partager.

### Lot 1 — Onglet Journée (parent)
- **Vue à la journée** + **bande de jours** navigable (semaines ‹ ›) ; jours en période
  teintés ; bandeau de période ; l'enfant n'apparaît que si la ligne le concerne en propre.
- **Moments** récurrents : ajout en **un tap** (suggestions) ou formulaire (heure,
  **sélecteur de jours** avec raccourcis « jours d'école » = lun–ven / « tous les jours »,
  tags enfants, lieu). Édition/suppression.
- **Périodes** (vacances/Ramadan/voyage) : **copie du rythme habituel** ajustable, prend
  le dessus sur la plage ; **chevauchement interdit** ; dates invalides bloquées.
- **Ponctuels** : un événement sur un seul jour, par-dessus, sans modifier le rythme.

### Lot 4.1 + 4.3 — Langue & lien (le socle du partage)
- **Langue réglée par destinataire** (dans sa fiche) : **Français (auteur) · الدارجة ·
  العربية · English** (darija distincte de l'arabe standard) ; multi-destinataire.
- **Un seul lien permanent, scopé** au destinataire (ses enfants, son rôle, sa langue) :
  **Envoyer sur WhatsApp** (pré-rempli) + **QR** (généré localement) + **accusé de
  lecture** ; **mise à jour en place** (on renvoie le même lien).

### Lot 5 — Page reçue (employée)
- Atterrit sur **aujourd'hui** ; bande de jours ; fiche du jour + bandeau période.
- **3 accès d'un seul niveau** : *Que faire si…* / *Qui appeler* (**appel au tap**) /
  *Les enfants*. **Lecture seule**, **hors-ligne**, **RTL + police arabe** si langue arabe.

### Lot 2 — Conduites
- Bibliothèque de protocoles **rédigés par le parent** (santé/sécurité/quotidien, badge
  Urgent), **gabarits « à compléter »**, ajout *Rédiger* ou *Partir d'un modèle*.
- **Consignes vocales** : enregistrement de **la voix du parent (jamais synthétisée)**,
  rejouée côté nounou. *Invariant : aucun conseil généré par l'app.*

### Lot 3 — Fiche urgence
- **Numéros Maroc 19/15/150 « à vérifier »**, **contacts** (appel au tap), **règles &
  autorisations** (autorisé/interdit), **fiches enfants** (allergie en évidence,
  traitement, médecin, groupe, habitudes). Tout rédigé/confirmé par le parent.

### Lot 4.2 — Traduction + relecture
- **Français = source.** Traductions **dérivées, figées dans le lien, hors-ligne**.
- **Interface (libellés + dates) ET contenu rédigé** traduits → page reçue **entièrement**
  dans la langue cible (darija/arabe/anglais), RTL compris.

### Ajustements post-retours (même jour)
1. **Relecture du sensible rendue NON bloquante** (voir §D).
2. **Traduction complétée** : au départ seul le contenu était traduit (interface restait
   en français) → ajout d'un dictionnaire d'interface + dates localisées.

---

## D. Décision produit à intégrer au manifeste (changement de règle)

- Règle initiale **« non négociable »** : *le sensible (santé/urgences/conduites/
  allergies) n'est diffusé dans une nouvelle langue qu'après relecture du parent.*
- **Nouvelle règle (demande d'Amine)** : on **envoie tout traduit** même non relu ; la
  relecture devient un **rappel non bloquant** (compteur « à relire » + rappel à l'envoi),
  avec par item sensible **Valider / Éditer / Rejeter**. **Réversible.**

---

## E. Constantes (à conserver dans le manifeste)

- **Vocabulaire verrouillé** : *moment* (récurrent) · *ponctuel* (un jour) · *période*
  (plage) · *rythme habituel* (socle). Onglets : **Journée · Conduites · Fiche urgence**
  (« Repères » banni).
- **Invariants tenus** : voix **jamais synthétisée** ; **personnel = lecture seule** ;
  l'app est un **véhicule des consignes du parent, jamais un conseiller médical** ; une
  **langue d'auteur = source**, traductions dérivées et figées hors-ligne.

---

## F. Hors-MVP / reste à faire

- **Hors-MVP (volontaire)** : flux calendrier ICS exposé · rappel WhatsApp hebdo traduit
  · bascule de langue côté employée · création/édition côté employée · vidéo.
- **À brancher** : le **« Mot de Maman » du jour** (mémo vocal quotidien en hero de la
  page reçue).
- **À arbitrer** : garder la relecture non bloquante ou réactiver un gate ; filtrage fin
  des briques par destinataire ; synchro multi-appareils du document Nounou.

---

## G. Cuisine — inchangée aujourd'hui

Aucune évolution produit. Seul changement technique : le composant de **consigne vocale**
est devenu réutilisable (il sert aussi à Nounou) — comportement Cuisine identique.

## H. Infrastructure

Nounou **réutilise l'existant** : table `espaces` (lien capability), `espace_opens`
(accusé de lecture), bucket `shared` (audios). **Aucune nouvelle table.** Une edge
function de traduction a été déployée (même clé serveur que la génération de recettes).
