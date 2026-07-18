# READ-BACK — Mini-lot destinataires (« les échecs silencieux »)
**18 juillet 2026 · file n°1 d'`ETAT.md` · prérequis dur d'A7 · read-back AVANT code — STOP en bas.**

> **Source** : `READOUT_A7_DESIGN.md` (v2, 15/07 — committé au GO T1). Trois points du readout sont
> **périmés** depuis (tracés au DEVLOG, le doc n'est pas retouché) : ① §5 fiche 2 (câbler `revoked` +
> file de retry) — tranchée dans l'autre sens au GO T1 (supprimer ; « Retirer » conditionné à la
> connexion) ; ② §2 D12 « trois fiches » → cinq ; ③ §7 ne liste pas le piège D4+D10 (il vit dans
> `ETAT.md` § Ouvert). **D6 du readout est portée dans la fiche T2 ci-dessous.**

## Ce que le lot répare — la cause racine

Quatre des cinq fiches sont le même défaut : **du fire-and-forget sans état ni retour**. Le code tente,
échoue en silence, et l'UI affirme. La cinquième (`remappage langue`) est un désalignement de vocabulaire
qui coûtera cher à A7 si on le laisse.

**Zéro fenêtre token** : aucun SQL, aucune edge function — tout est client. Prod jamais touchée hors Pages.

---

## Tranche 1 — 🟢 « Les échecs silencieux » (fiches 1 · 2 · 4 · 5)

### F1 — `revokeEspace` fiabilisé (le bloquant)
**Constat (code)** : `espace.ts:241` — `await supa.from('espaces').delete().eq('token', …)` : l'erreur du
delete est ignorée, et `if (!supa) return` fait qu'**hors connexion la révocation « réussit » sans rien
faire**. `PartageSheet.tsx:205` supprime ensuite le destinataire local et toaste « son lien ne donne plus
rien » — le lien peut être vivant.
**Correctif** : `revokeEspace` retourne la vérité. Le caller **ne supprime le destinataire local QUE si
la révocation serveur a réussi** ; sinon toast honnête et rien n'est perdu.
**Sémantique du succès (cas limite gravé au GO T1)** : **succès = le serveur a répondu sans erreur —
jamais le rowcount.** Une personne jamais partagée n'a pas de ligne `espaces` : 0 ligne effacée n'est
pas un échec, c'est « rien à couper ». Échec = on ne l'a pas joint (réseau, session, erreur).
**Corollaire RLS** : la policy delete d'`espaces` (0006) est `to authenticated` + membre — un DELETE
**sans session** répond 200 avec 0 ligne **sans erreur** (RLS filtre, elle n'erreure pas). « Le serveur
a répondu » n'est donc honnête que **session exigée d'abord** : sans session → refus franc
(« Connecte-toi pour retirer… »), pas d'appel aveugle.
**Raison de fond (décision PO, gravée)** : l'invariant local-first vaut pour le **contenu**, pas pour le
**contrôle d'accès** — l'appareil ne peut pas être la source de vérité de qui a le droit de lire une
page ; cette vérité vit là où le jeton est vérifié. Conséquence : **« Retirer » est conditionné à la
connexion** (le modèle A7 « disparition immédiate du hub + file de retry » meurt ici — le thread A7
reprendra sa maquette).
**Porte** : le smoke Comptes tourne **déconnecté** — il asserte le refus honnête (aujourd'hui c'est le
faux succès qui passerait) et que la personne est conservée. + tests Vitest sur la sémantique du retour.

### F2 — `revoked` : **SUPPRIMER — tranché au GO T1** (le §5 fiche 2 du readout est mort)
**Constat** : `types.ts:194` — champ défini, **jamais lu, jamais écrit**. La révocation *supprime* le
destinataire : un drapeau sur un enregistrement qui disparaît est mort par construction — et le modèle
couper/créer plaidait déjà pour la suppression (question ③ que le readout laissait ouverte). Le
soft-revoke (garder la personne, tuer le lien) = cycle de vie du token → A7-C2 (audit §7.8). Champ
optionnel synchronisé : suppression compat-safe (les anciens payloads l'ignorent).

### F4 — `backupImage` : un état, jamais de retry aveugle (méthode gravée, décision PO 15/07)
**Constat** : `FichePhoto.tsx` — `void backupImage(…)` fire-and-forget ; toute photo posée hors-ligne /
sans session / avant 0010 reste locale **pour toujours** (l'audio se rattrape à chaque publication, la
photo jamais).
**Correctif** : `RecipeImage` gagne **`backedUp?: boolean`** (IDB, champ optionnel — pas de bump de
version). `backupImage` rapporte son succès → le flag est posé. À l'ouverture d'une fiche :
photo locale **et `backedUp` faux** → une retentative silencieuse (et une seule), flag posé si succès.
Jamais de re-upload d'une photo déjà sauvée (le retry aveugle re-téléverserait tout à chaque parcours —
rejeté PO).
**Porte** : tests Vitest sur la transition d'état (pas de retry si `backedUp`, retry si faux, flag posé).

### F5 — cache négatif 404-only (audio **et** images — même bug dans le miroir)
**Constat** : `sync/audio.ts:43` et `sync/images.ts:46` — `missing.add()` sur TOUT échec, réseau inclus :
une note vocale présente au cloud paraît perdue toute la session après un raté réseau.
**Correctif** : helper `isNotFound(error)` (statut 400/404 storage) partagé ; `missing.add()` seulement
sur « objet absent ». Échec réseau → on retentera au prochain montage. ~6 lignes × 2 fichiers + tests
du helper.

**Chiffrage T1 : 🟢 petit** (~80-100 lignes tout compris, 4 fichiers + tests). Risque principal : la
sémantique d'échec de F1 dans l'UI (une chaîne de plus, pas de refonte).

---

## Tranche 2 — 🟡 remappage langue `'ar'` → `'dr'` (isolée, sa propre porte — comme demandé)

**Constat** : `Destinataire.langue: 'fr' | 'ar'` où **`'ar'` veut dire darija** (l'UI affiche الدارجة,
`augmentDarija` est appelé) — alors que le vocabulaire Nounou est le bon : `'dr'` = darija, `'ar'` =
arabe standard (`types.ts:346`). A7 unifiera les personnes : deux codes pour la même langue = dette.

**Périmètre du remap — le modèle LOCAL seulement, le fil reste `'ar'`** :
- **Modèle** : `Destinataire.langue: 'fr' | 'dr'`. Création (`PartageSheet.blank` → `'dr'`,
  `Ftue.tsx:62` → `'dr'`), affichages alignés.
- **Migration** : normalisation à la lecture (`loadDestinataires` + fusion sync : `'ar'` legacy → `'dr'`)
  — couvre l'IDB locale ET les payloads `docs` venant d'appareils pas encore à jour.
- **Le payload PUBLIÉ ne bouge pas** : `Espace.langue` reste `'fr' | 'ar'` (mapping au publish :
  `'dr'` → `'ar'` sur le fil). **Compat perpétuelle des payloads publiés** — la page reçue d'hier doit
  vivre pour toujours, et un APK pas encore mis à jour doit pouvoir lire ce qu'on publie. Le vocabulaire
  du fil se renégociera à A7/D2 (liste ouverte), pas ici.
- **⚠️ Le risque qui fait le 🟡** : sync inter-appareils pendant la transition — un appareil à jour
  pousse `langue:'dr'` dans `docs`, un appareil PAS à jour lit `'dr'`, teste `=== 'ar'` → afficherait
  FR pour une darijophone jusqu'à sa mise à jour (PWA se met à jour vite — skipWaiting —, l'APK non).
  Fenêtre courte et réversible (aucune donnée perdue), mais réelle : c'est pourquoi la tranche est
  isolée et derrière ta propre GO.
- **Sa porte** : test « aucun code ne crée un destinataire `'ar'` » + test de normalisation (IDB +
  adoption sync) + test du mapping au publish + smoke inchangé (la page reçue rend toujours الدارجة).
- **D6 (readout A7, obligation portée ici — c'est CETTE fiche qui fixe la sémantique, personne d'autre
  ne le fera)** : la fiche définit noir sur blanc ce que chaque code signifie —
  **`'fr'` = français · `'dr'` = darija marocaine (lettres arabes) · `'ar'` = arabe standard moderne
  (fusha), libellé UI « Arabe classique » — PAS le registre coranique** (une nounou qui lit une consigne
  d'urgence a besoin du MSA) · `'en'` = anglais. Rayon d'explosion sans remap : l'élargissement D5
  ferait basculer tous les destinataires Cuisine `'ar'` de la darija vers l'arabe classique **en silence**.
- **Question du fil, à ne pas laisser découvrir par l'élargissement** : `'ar'` sur le fil v:1 = darija,
  pour toujours. Quel code portera l'arabe standard sur le fil ? **Proposition** : `v: 2` au moment de
  D5 (le champ `v` existe déjà) — en v:2 `langue` adopte le vocabulaire catalogue (`'ar'` = MSA) ; les
  lecteurs gardent à jamais l'interprétation v:1 (`'ar'` = darija quand `v === 1`). Tracé dans
  `ETAT.md` § Ouvert, à valider.

**Chiffrage T2 : 🟡 moyen-petit** (~60 lignes, mais 3 frontières : IDB, sync, fil publié).

---

## Rituel

- **Ordre** : T1 → STOP → GO → T2 → STOP → clôture (DEVLOG + **ETAT.md réécrit** — critère de fini,
  règle n°1 ; merge → défaut ; portes re-vérifiées sur le défaut mergé).
- **Portes par tranche** : typecheck · Vitest (143 + nouveaux) · build web + natif · 3 smokes · captures
  (T1 : refus honnête de révocation déconnectée).
- **Branche** : `mini-lot-destinataires-v1` (créée, `apk.yml` pointé dessus selon le rituel).

## Questions au GO — répondues (GO T1, 18/07)

1. **F2 `revoked`** : **supprimer** — validé (rejoint la question ③ du readout : couper/créer plaide
   pour la suppression). Raison de fond gravée dans la fiche F1.
2. **T2 fil publié** : **`'ar'` reste le code darija sur le fil pour ce lot** — validé. La suite est
   nommée dans la fiche T2 (proposition `v: 2` à l'élargissement D5) et tracée dans `ETAT.md` § Ouvert.

**GO T1 reçu le 18/07 — T2 après le STOP T1, tranche isolée avec sa propre porte.**
