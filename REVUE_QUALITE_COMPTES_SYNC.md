# Revue qualité — Lot « Comptes + Sync » (branche `comptes-sync-v1`)

> Revue à froid demandée par Amine avant la suite (passe prod). Périmètre : les
> **13 commits** du lot (`8992a3f...HEAD`, ~1 960 lignes, 37 fichiers). Méthode :
> 8 angles de relecture indépendants (ligne-à-ligne, comportements supprimés,
> traçage inter-fichiers, réutilisation, simplification, efficacité, altitude,
> conventions CLAUDE.md), dédup 32 candidats → vérification → **10 findings retenus**.
> 2026-07-05.

## Portes qualité (re-passées pendant la revue)

| Porte | Résultat |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ 17 fichiers, **98 tests** |
| `npm run build` | ✅ |
| `npm run smoke` (Playwright) | ✅ parcours complet, aucune erreur console/page |
| Conventions CLAUDE.md (secrets, DEVLOG/commit, UI FR, tests) | ✅ aucune violation (vérifié par grep : aucun secret committé) |

**Mais** : ces portes n'exercent pas les chemins connectés (RLS) ni le multi-appareil —
c'est là que la revue a trouvé les vrais problèmes.

## Verdict global

Le lot est **solide dans son cœur testé** (plan.ts pur, RLS validée 9/9, schéma sain).
Les bugs trouvés se concentrent sur **les coutures** : changement/re-jonction de foyer,
fenêtre d'adoption, ordre de déploiement prod, et les stores hors-zustand.
**3 findings bloquent la mise en prod** (P0), les autres se corrigent avant ou juste après.

## P0 — bloquants avant toute passe prod

1. **Foyer orphelin → suppression de compte définitivement cassée** — `accept-invite/index.ts:54` + `leaveFoyer` (`auth.ts:65`). Quand un **owner** rejoint un autre foyer (ou quitte le sien), sa ligne `membres` part mais son foyer reste (`owner_user_id` **ON DELETE RESTRICT**) → docs inaccessibles à jamais **et** `deleteUser` bloqué par la FK → `delete-account` 500 permanent. **Violation Apple 5.1.1(v)** + fuite de données. *Fix : dans accept-invite/leaveFoyer, si owner → supprimer (ou transférer) l'ancien foyer ; et delete-account doit aussi balayer `foyers.owner_user_id = uid`.*

2. **`publishEspace` casse la publication en prod si 0002 n'est pas appliqué + espaces non-rattachés** — `espace.ts:147`. La colonne `foyer_id` n'existe pas en prod tant que 0002 n'est pas jouée → **tout envoi de page casse** au déploiement (ordre fragile, même documenté). Et `currentFoyerId()` avale les erreurs → `foyer_id null` possible → page qui **échappe à la révocation en cascade** promise à la suppression. *Fix : tolérer la colonne absente (retry sans foyer_id), remonter l'erreur de `currentFoyerId`, et re-taguer au prochain publish.*

3. **Login prod cassé (base path)** — `auth.ts:16`. `emailRedirectTo: window.location.origin` a perdu le `+ pathname` de l'ancien `sendMagicLink` → sur GitHub Pages `/Heath/`, le lien magique renvoie à la racine du domaine = **404, connexion impossible en prod**. (Passait sur la préview Cloudflare car servie à la racine — c'est pour ça que le test staging était vert.) *Fix : `origin + pathname` (ou `import.meta.env.BASE_URL`).*

## P1 — intégrité de la sync (avant d'ouvrir le multi-appareil à de vrais foyers)

4. **`markFoyerAdopted` posé même si `adopt()` a échoué** — `useSync.ts:33` → l'adoption « cloud gagne » ne se rejoue jamais ; le push suivant écrase le cloud avec le local. *Fix : ne marquer qu'en l'absence d'erreur.*
5. **Flag `adopted:` jamais nettoyé + curseur de pull GLOBAL** — `useSync.ts:31` + `db.ts` (`syncCursor`) → re-rejoindre un ancien foyer = adoption sautée + pull filtré par le curseur de l'autre foyer = **docs invisibles à jamais**. *Fix : curseur par foyer (`cursor:<foyerId>`) + reset du flag/curseur au changement de foyer.*
6. **Stores non-cuisine de seconde zone** — `useStore.ts:97` + `useSync.ts:69`. Le pull ne rafraîchit pas les vues nounou/sécurité/destinataires (stores hors zustand cuisine) → **vue périmée qui ré-écrase le doc nounou (blob LWW) cloud-wide** ; et leurs saves ne déclenchent aucun push. *Fix : signal de changement générique (émis par db.ts) + invalidation de useNounou/vues au pull.*
7. **Push pendant la fenêtre d'adoption** — `useSync.ts:69`. `foyerRef` est posé avant la fin d'`adopt()` : une édition pendant l'adoption pousse du local qui écrase le cloud avant la fusion. *Fix : gater le push sur « adoption terminée ».*
8. **Curseur avancé au-delà des docs sautés par G2** — `engine.ts:122`. Si le doc local redevient propre sans être poussé (undo, push interrompu), la version distante sautée n'est **plus jamais re-pullée**. *Fix : n'avancer le curseur que jusqu'au dernier doc non-sauté (ou re-fetch des skipped au prochain cycle).*
9. **Comptage quota IA non fiable** — `generate-recipe/index.ts:154`. Read-modify-write non atomique (course au double-tap = génération non comptée) + **pas de refund quand `fetch(Anthropic)` throw** (seul `{error}` rembourse). *Fix : RPC SQL atomique (`update … set used = used+1 where used < cap returning`) + refund dans un `finally`/catch.*
10. **`deleteAccount` ne purge pas l'état local** — `auth.ts:112`. IndexedDB + syncmeta + flags survivent → une **ré-inscription re-téléverse les données « supprimées »** (promesse RGPD rompue). *Fix : au minimum purger syncmeta/flags/curseur + proposer l'effacement local dans la confirmation.*

## P2 — corrections rapides & backlog qualité (hors cap des 10)

- **Badges « / 5 » codés en dur** ×2 (`AddRecipeSheet.tsx:111,315`) alors que la limite est passée à 100 → afficher `AI_MONTHLY_LIMIT`. *(30 s.)*
- **FC16 « compléter la semaine »** consomme désormais le quota serveur (1 unité × repas vide) sans décrémenter le cache d'affichage, et avale les 429 en « Génération indisponible » → message « quota atteint » + synchro du cache (le serveur renvoie `quota:{used,cap}` : l'utiliser).
- **Fuseau du mois** : client = mois local (`quota.ts`), serveur = mois UTC (`slice(0,7)`) → dérive d'affichage aux frontières de mois. Aligner (UTC des deux côtés).
- **Course d'effet async audio** (`VoiceNote.tsx:71`, `ConsigneVocale.tsx`) : `restoreAudio` lent + navigation → audio du mauvais élément + fuite d'object URL. Ajouter un flag `cancelled`.
- **Efficacité sync** : push = 1 upsert HTTP **par doc** (30+ round-trips au 1ᵉʳ push) → **batcher** (PostgREST accepte un tableau) ; `collectLocalDocs()` recharge/re-hash tout à chaque cycle (×3 à la connexion) ; `currentFoyerId()` sans cache (2 round-trips par appel, appelé à chaque mount audio) ; `restoreAudio` sans cache négatif (download 404 répété pour chaque recette sans audio) ; `ensureFoyer` à chaque ouverture du sheet.
- **Réutilisation** : extraction d'erreur edge-fn en **3 copies** (`fnError` + 2 inline dans `ai.ts`) ; CORS+`json()` en **5 copies** dans les edge functions (`_shared/` à créer) ; boucles `applyRemote+putSyncMeta` / `upsertDoc+putSyncMeta` dupliquées ×4 dans `engine.ts` ; `deleteById` vs deletes dédiés.
- **Altitude** : la syncabilité des champs `app` vit en 2 endroits (`appForSync` strip + merge `applyRemote`) → déclarer un schéma de champs syncables ; `window.location.reload()` comme mécanisme de ré-adoption (fonctionne, mais fragile).
- **Écran « code 6 chiffres »** avec e-mail qui n'envoie qu'un lien : **état temporaire connu et accepté** (résolu par le SMTP) — documenté, pas un finding.

## Plan de correction proposé

- **Passe FIX-1 (avant passe prod, bloquant)** : P0 n°1–3 + les quick-wins P2 (badges, refund quota, cancelled audio). ~½ journée.
- **Passe FIX-2 (intégrité multi-appareil, avant d'inviter un 2ᵉ vrai membre)** : P1 n°4–10. ~1–1,5 jour. Les correctifs sont tous **localisés** (pas de refonte du moteur : le cœur pur est sain, ce sont les coutures).
- **Backlog** : efficacité/réutilisation P2 au fil de l'eau (le batching du push en premier — c'est le plus visible utilisateur).

> Note d'honnêteté : la validation staging « 9/9 » couvrait le chemin nominal
> (1 foyer, sessions du même utilisateur). Les bugs trouvés vivent presque tous dans
> les **transitions** (changer de foyer, adoption qui échoue, re-inscription, ordre de
> déploiement) — exactement ce qu'une QA nominale ne voit pas. C'est le rôle de cette revue.
