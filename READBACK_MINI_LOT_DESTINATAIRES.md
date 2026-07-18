# READ-BACK — Mini-lot destinataires (« les échecs silencieux »)
**18 juillet 2026 · file n°1 d'`ETAT.md` · prérequis dur d'A7 · read-back AVANT code — STOP en bas.**

> **Source manquante au repo** : le *readout A7 design v2* (§5, fiches 1-3 « déjà instruites ») est un
> doc côté PO, absent du dépôt. Les fiches 1-3 ci-dessous sont instruites depuis le code réel + le
> backlog qualité + les décisions tracées (DEVLOG 15/07). **Si le readout dit autre chose, corrige à ce
> STOP — et passe-moi le doc, je le committe (même règle que les maquettes).**

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
**Correctif** : `revokeEspace` retourne la vérité (lance en cas d'échec ; `!supa`/hors-ligne = échec,
pas un succès). Le caller **ne supprime le destinataire local QUE si la révocation serveur a réussi** ;
sinon toast honnête « Impossible de révoquer maintenant (hors-ligne ?) — la personne est conservée,
réessaie » et rien n'est perdu. Cas « jamais publié » (0 ligne effacée) = succès légitime.
**Porte** : le smoke Comptes tourne **déconnecté** — il assertera le refus honnête (aujourd'hui c'est le
faux succès qui passerait). + test Vitest sur la sémantique du retour.

### F2 — `revoked` : câbler ou supprimer → **je propose SUPPRIMER**
**Constat** : `types.ts:194` — champ défini, **jamais lu, jamais écrit**. Or la révocation actuelle
*supprime* le destinataire : un drapeau sur un enregistrement qui disparaît est mort par construction.
Un soft-revoke (garder la personne, tuer le lien) = cycle de vie du token → c'est le chantier A7-C2
(audit §7.8), pas ce mini-lot. Champ optionnel synchronisé : sa suppression est compat-safe (les
anciens payloads l'ignorent). **Si tu veux le câbler au lieu de le supprimer, dis-le au GO.**

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

**Chiffrage T2 : 🟡 moyen-petit** (~60 lignes, mais 3 frontières : IDB, sync, fil publié).

---

## Rituel

- **Ordre** : T1 → STOP → GO → T2 → STOP → clôture (DEVLOG + **ETAT.md réécrit** — critère de fini,
  règle n°1 ; merge → défaut ; portes re-vérifiées sur le défaut mergé).
- **Portes par tranche** : typecheck · Vitest (143 + nouveaux) · build web + natif · 3 smokes · captures
  (T1 : refus honnête de révocation déconnectée).
- **Branche** : `mini-lot-destinataires-v1` (créée, `apk.yml` pointé dessus selon le rituel).

## Questions au GO (2)

1. **F2 `revoked`** : je supprime le champ (recommandé — mort par construction, soft-revoke = A7-C2).
   D'accord, ou tu veux le câbler ?
2. **T2 fil publié** : je garde `'ar'` comme code darija SUR LE FIL (compat perpétuelle, remap local
   seulement). D'accord, ou tu veux basculer le fil aussi (coût : versionner le payload) ?

**⏸ STOP read-back — j'attends ton GO (et le readout A7 §5 si ses fiches disent autre chose).**
