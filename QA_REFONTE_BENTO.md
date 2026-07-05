# Guide de session Q&A — Refonte « Bento lumineux » → **Manzil**

> Document pour piloter une **session de Q&A / QA approfondie** de la refonte
> (Lots 0→3, branche `refonte/bento-v1`, prévue déployée). À lire **avec**
> `PASSATION_REFONTE_BENTO.md` (audit + architecture) et `DEVLOG.md` (journal + ADR).
> Écrit à la main. Dernière mise à jour : **2026-07-05**.

---

## 0. But & état

- **But de la session** : passer la refonte au crible — parcours utilisateur, fidélité au prototype,
  invariants produit, cas limites — et **remonter les écarts** (bugs, incohérences, questions produit).
- **État** : refonte **fonctionnellement complète** (Lots 0→3). Qualité automatisée **verte** à chaque
  commit : `typecheck` + **90 tests Vitest** + `build` + `smoke` Playwright. Ce guide couvre ce que
  l'automatisation **ne** couvre **pas** (jugement visuel, UX, cas réels réseau).
- **Ce n'est PAS fusionné en prod** : c'est une **prévue**. Le merge est une décision d'Amine.

## 1. Où tester

- **Prévue en ligne** (recommandé pour le manuel) : **https://diasporabookproject-cpu.github.io/Heath/**
  PWA → **rafraîchir 1–2×** pour vider le cache du service worker. Installable écran d'accueil.
- **Local** (pour lire le code / rejouer le smoke) :
  ```bash
  git fetch origin refonte/bento-v1 && git checkout refonte/bento-v1
  npm ci && npm run typecheck && npm run test && npm run build
  npm run preview &   # http://localhost:4173
  npm run smoke
  ```
- **Vitrine design system** : `#…/#mz-demo` (primitives `mz-`, LTR **et** RTL). Hors nav de prod.
- **Spec de comportement** : `prototype-interactif-v6-1-bento.html` (objets `WA`, `state`/`render`,
  sheets `sh-*`). Référence de fidélité — l'app **converge** dessus (l'UX proto gagne, sauf invariants/données).

## 2. ⚠️ Limites de test (à connaître AVANT de qualifier un bug)

Ces comportements sont **attendus**, pas des régressions :

1. **Envoi réel = session Supabase requise.** Publier une page + ouvrir WhatsApp + voir l'état de
   transmission repasser **✓** + l'accusé de lecture → nécessite d'être **connecté** (icône ☁︎, lien magique).
   Hors connexion, la feuille invite à se connecter. **À tester manuellement, connecté.**
2. **Pastilles « Briefer » / « Planifier » (Maison)** n'apparaissent que si la page est **à jour**
   (`uptodate`) — donc **après un envoi réel**. En état neuf (jamais envoyé) on voit **« Envoyer »**.
3. **Page reçue (`#e=`)** : son rendu Manzil n'est vérifiable que sur un **lien publié réel**.
4. **Rappel** : v1 **pastille only** — **aucune notification système** (choix produit). La mention
   apparaît **à l'ouverture de l'app** (« ton rendez-vous du {jour} {heure} ») si la page est modifiée
   ET l'échéance passée. Pas de push, pas d'alerte hors-app : c'est **voulu**.
5. **Noms de classes `cz-/nz-/ck-`** subsistent dans le code (identité visuelle = Manzil ; renommage
   littéral abandonné, cf. ADR 1). Non visible utilisateur.
6. **Quota IA** = front-only (réinitialisable en vidant le stockage) — c'est un **garde-fou**, pas un paywall.

## 3. Check-list de parcours (manuel)

Cocher ✅/❌/⚠️ et noter l'écart. Ordre suggéré.

### A. Maison (hub)
- [ ] Salutation + date du jour corrects.
- [ ] **Aujourd'hui** : héros « Prochain » (bon rôle/heure) ; timeline (passé grisé) ; **teinte par rôle**
      (cuisine vert / nounou violet). En fin de journée → **« Journée terminée 🌙 »** (pas de faux « prochain »).
- [ ] **Ton équipe** : chaque personne = **une** pastille (Envoyer / Briefer / Planifier / ✓ chevron).
- [ ] Rôle sans destinataire → carte « Prépare la page » (accès garanti).
- [ ] « La maison » 🛡️ → Sécurité. « + une page » → feuille (Entretien/Chauffeur/Quelqu'un d'autre).

### B. Navigation
- [ ] Ouvrir Cuisine / Nounou → **plein écran + retour « ‹ Maison »**. Pas de bottom-tabs.
- [ ] Tap « Envoyer » sur une personne → ouvre la page **+ feuille d'envoi pré-sélectionnée** sur elle.

### C. Cuisine (héros vert)
- [ ] Onglets Semaine / Recettes / Courses ; générer/composer un repas ; feux & moyennes.
- [ ] **Fiche recette** : **calcium visible** (cellule ambre) ; mesures **càc/càs non normalisées**.
- [ ] **3 portes** (＋ Recettes) : ① Depuis la bibliothèque → **collections** ; ② Saisie manuelle →
      **naît « Validé »** (pas de relecture), lien discret « Coller du JSON » ; ③ ✦ IA (connecté) →
      **un seul champ** (colle **ou** décris) → brouillon `Test`. **Quota** « N / 5 ce mois », épuisé → grisé.
- [ ] **File de relecture** : bannière « ✦ N brouillons IA à relire » → écran **1/N** (Supprimer/Modifier/
      Valider), avertissement si artefact ; **plus de bouton « Valider » par ligne**.
- [ ] **Collections** : rail en pied de biblio ; pack → liste cochable → **Ajouter les N** ; **réinstaller
      n'ajoute pas de doublon** ; une recette de pack se modifie/supprime comme une autre.

### D. EnvoiSheet v2 (Cuisine & Nounou)
- [ ] Titre « Envoyer à {prénom} » ; **portées** (chips) ; **le message change avec la portée**, la page
      envoyée reste complète. Bulle **éditable**.
- [ ] Portée sur un jour **vide** → message honnête + **confirmation 2 taps**.
- [ ] Destinataire **sans téléphone** → bouton « **Publier + copier le message** ».
- [ ] Nounou : chip **📌 événement** seulement s'il y a un ponctuel à venir ; **langue/enfants/traduction** conservés.
- [ ] Ligne **🔔 Rappel d'envoi** → mini-sheet jours × heures (microcopy « pas de notification »).
- [ ] *(connecté)* Envoi réel → WhatsApp pré-rempli ; retour Maison → état **✓ transmis** ; accusé remonte.

### E. Nounou (héros violet)
- [ ] Bande de jours ; moments (icônes violettes) ; Conduites ; Fiche urgence ; partage.
- [ ] Darija / **RTL** intacts sur la page reçue et les sheets concernés.

### F. Sécurité & espaces reçus
- [ ] « La maison » : fiches, statuts, import pack de démarrage.
- [ ] *(lien publié)* Page reçue `#e=` : lisibilité, **darija/RTL**, hors-ligne.

### G. PWA / transverse
- [ ] Installation écran d'accueil ; **hors-ligne** ; rafraîchissement du cache.
- [ ] **FR** partout côté admin ; aucune fuite de secret ; local-first (données persistent).

## 4. Invariants à vérifier (rappel — NE DOIVENT PAS casser)
- **UI en français** ; darija (lettres arabes) pour cuisinière/nounou ; **RTL** correct.
- **Calcium visible partout** ; **càc/càs non normalisées**.
- **Local-first** (IndexedDB) ; aucune capacité supprimée sans accord (« rhabiller, pas retirer »).
- **Aucun secret** committé (seule la clé publishable Supabase, publique, dans `deploy.yml`).

## 5. Questions ouvertes / points de décision (pour Amine)
1. **Merge en prod** : quand ? (au merge : retirer le déclencheur `refonte/bento-v1` du workflow).
2. **Packs** : « Marocain du quotidien » = seed (apparaît Installée) — garder, ou en faire un vrai pack de
   recettes **nouvelles** ? Contenu éditorial riche = chantier séparé.
3. **Rappel** : le besoin « être rappelé sans ouvrir l'app » (notification/push) est au backlog — priorité ?
4. **Espaces reçus** : gardés en Manzil (cohérence) — confirmer après vérif visuelle sur lien réel.
5. **« Un jour… » (Cuisine)** : sélecteur de jour minimal (chips L→D) — suffisant ou enrichir ?

## 6. Comment remonter les écarts
Pour chaque écart : **écran + étapes de repro + attendu vs observé + gravité** (bloquant / gênant / cosmétique)
+ si possible une **hypothèse de cause** (fichier). Regrouper par zone (A–G). Distinguer **bug** vs
**choix produit à rediscuter**. Ne pas qualifier de bug les points du §2 (limites connues).

## 7. Contexte produit (rappel)
App PWA mobile-first (React + Vite + TS) pour **centraliser le savoir du foyer et le transmettre au
personnel** (cuisinière Khadija, nounou Fatima) qui lit **dans sa langue**. Voir `BRIEF_PRODUIT.md`.
