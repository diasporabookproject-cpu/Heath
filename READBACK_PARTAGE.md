# Read-back — Lot « Refonte du partage + suivi des tâches »

**Branche** `lot-partage-v1` · **statut : fonctionnellement complet, bout-en-bout validé device · en attente de GO clôture.**
Read-back de clôture — à lire avant le merge au défaut.

---

## 1. Ce que le lot livre

**Le premier flux BIDIRECTIONNEL du produit** : un état qui remonte du personnel vers l'employeur.
Deux parties dans un lot :

- **A — Refonte visuelle de la feuille de partage** (sur fonctions existantes) : registre « relief et aisance, pas contrôle ».
- **B — Suivi des tâches** (mécanique nouvelle) : le personnel coche sur sa page reçue ; l'employeur voit l'état quand il consulte.

---

## 2. Les 4 questions d'architecture — tranchées et IMPLÉMENTÉES

| Q | Décision | Preuve en base / en code |
|---|---|---|
| **① Où vit l'état ?** | Journal **insert-only** `espace_checks` (patron `espace_opens`), état courant = dernière ligne par item (LWW). Refus du payload (écrivain unique connecté). | `0011_espace_checks.sql` · `lib/espace-checks.ts` |
| **② Remontée sans compte ?** | Insert anon par jeton, même canal que la lecture publique + l'accusé (`logEspaceOpen`). | `sendCheck` · policies 0011 |
| **③ Offline / concurrence ?** | Optimiste local → file `localStorage` rejouée dans l'ordre au retour réseau ; LWW par item ; l'employeur voit l'état serveur (pas temps réel, comme cadré). | `flushPending`/`queuePending`/`mergePending`, 9 tests |
| **④ Lien perpétuel ?** | `cl?`/`tasks?` **optionnels à jamais** (patron `gouter?`) : une page d'avant rend à l'identique. | `espace-checklist.test` + `espace-payload-checklist.test` |

**Exigence 🔴 (PO) — révocation vraie par construction** : les policies `0011` (insert **et** select) portent la **jointure d'existence sur `espaces`** — un jeton révoqué rend ses coches illisibles. **Prouvé en base** (staging + prod) : révoqué → `select anon = 0`, corollaire postgres voit encore la ligne (la policy cache, ne supprime pas).

---

## 3. Découpage livré (T1→T4 + correctifs)

- **T1** — feuille d'envoi v2 (maquette) : « Partager avec {nom} », « Reçoit en الدارجة », **message = mot court préretempli** (« Bonjour {nom} 👋 / il est ici 👇 / lien ») + **toggle Français|الدارجة** (défaut = langue de lecture), bulle WhatsApp, **Accès permanent** (QR frigo + copier le lien). Registre neutre (`ROLES` dégenrés). Feuille épurée à la maquette (Rappel d'envoi + Dernier accès retirés).
- **T2** — socle : `0011` (journal, policies jeton vivant) + `lib/espace-checks` (clés d'item, LWW, file offline). **9 tests bloquants.**
- **Fenêtre 0011** — staging → 5 preuves → GO PO → **prod** → révocation token → mort 401 → **parité 0**. Journalisée.
- **T3** — page reçue : cases sur **chaque repas du menu** (correctif : plus « aujourd'hui seulement ») + tâches ; offline-first (file + cache) ; aperçu employeur inerte ; tâches **fr seul** (darija parquée §7.4, non masquée).
- **T4** — retour employeur : l'**aperçu** lit l'état RÉEL en lecture seule (`viewChecksToken`) + résumé « N coché · vu HH:MM » (non bloquant).

**Portes** : typecheck ✓ · **223 tests** ✓ · build ✓ · 3 smokes ✓ (dont porte bout-en-bout : registre neutre → toggle → tâche → cases + fr-en-darija sur l'aperçu).

---

## 4. Validation device — bout-en-bout ✅

Diagnostic clé : la page reçue est servie par **GitHub Pages = branche par défaut** ; le code checklist n'y était pas → aucune case (pas un bug de rendu). `deploy.yml` **repointé temporairement** sur `lot-partage-v1` → Pages redéployé → **PO confirme : les cases s'affichent et la cuisinière coche**, la remontée est vive en prod.

---

## 5. Ce qui reste pour la CLÔTURE (au GO)

1. **Merge** `lot-partage-v1` → défaut (`--no-ff`) → Pages redéploie le défaut.
2. **Repointer `deploy.yml` ET `apk.yml`** de `lot-partage-v1` vers le défaut (les deux suivent la branche du lot pendant le lot).
3. Portes re-vérifiées sur le mergé · **réécrire `ETAT.md`** · tag `lot-partage-v1`.

---

## 6. Assumés / parkés (à confirmer)

- **Darija du message** = premier jet (« سلام {nom} 👋 / المنيو ديالك واجد، شوفيه هنا 👇 ») — à faire relire (§7.4). Le fr est définitif.
- **Message court** : ne liste plus les plats (le détail vit sur la page). `buildCuisineDigest` détaillé conservé + testé — retour arrière trivial si le PO veut le résumé des repas dans WhatsApp.
- **Notifications** : hors lot (phase 2). L'employeur voit l'état en consultant.
- **Accusé de lecture** (« Dernier accès ») : retiré de la feuille, réintégré dans l'aperçu (barre T4) — à confirmer que c'est le bon endroit.
