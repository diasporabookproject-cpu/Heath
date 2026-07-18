# READ-BACK — Audit sécurité §7.8 (Ambition A : fermer les fuites connues)
**18 juillet 2026 · passe de durcissement, PAS une spec · read-back AVANT tout code — STOP en bas.**
**Branche `audit-securite-v1`, `apk.yml` pointé. Chasse offensive (Ambition B) hors périmètre.**

> **Méthode.** Pour chaque point : l'état RÉEL (fichier:ligne), le risque concret, l'option de
> correctif, le chiffrage 🟢🟡🔴, la porte qui verrouille. **Ce lot laisse des assertions, pas
> seulement des correctifs.** Certaines fenêtres touchent la prod (RLS/SQL) → **rituel token**
> (staging ×2 idempotence → `parity:check` → STOP signalement → GO → prod → révocation → mort
> vérifiée → parité de clôture). Je le signale par point.

---

## ⚠️ Constat qui reforme le lot : ① et ② sont DÉJÀ FERMÉS (AS-2, migration 0006, en prod)

Avant de chiffrer, la vérité du code — sinon on paierait deux fois :

**① `espace_opens` — lecture inter-foyers : FERMÉE.** `0006_espaces_close_write.sql:41` remplace
`espace_opens read auth using (true)` (la fuite : tout authentifié lisait tous les jetons) par une
lecture **jointe au foyer propriétaire** :
```sql
using (exists (select 1 from public.espaces e
  where e.token = espace_opens.token and e.foyer_id is not null
    and public.is_foyer_member(e.foyer_id)))
```
**② Policies `espaces` ouvertes : FERMÉES.** `0006:24-39` : insert/update/delete passent de
`with check (true)` à `foyer_id is not null and public.is_foyer_member(foyer_id)`. C'est
exactement le mini-lot destinataires F1 qui s'appuyait dessus (RLS silencieuse sans session).

**Preuve que c'est en prod** : DEVLOG « AS-2 CLOS » (migrations 0006→0009 prod), et le mini-lot
destinataires F1 vient de vérifier live que le delete sans session est filtré. Le
`0001b_espaces_legacy.sql` qui montre les vieilles policies `true` **ne s'applique QU'AU staging**
(il reconstruit l'état pré-AS-2 pour que 0006 le corrige — cf. son en-tête).

**Ce qui reste vraiment ouvert sous ① et ②** (les résidus, pas les fuites) :
- **①-résidu — `espace_opens insert anon check(true)`** (`0006:12-14`, laissé VOLONTAIREMENT) :
  n'importe qui peut insérer des accusés bidon pour un jeton connu → « Dernier accès » ment
  (spam de reçus). **Ce n'est pas une fuite d'isolation** (on n'exfiltre rien), c'est une nuisance.
  Correctif possible : borner l'insert (un accusé par (token, jour), ou passer l'accusé par une
  RPC `definer` qui valide le token). **🟡** — touche la prod (policy/RPC), rituel token.
- **②-résidu — espaces legacy `foyer_id NULL`** (pré-comptes) : non-écrivables depuis le client
  (`is_foyer_member(null)` = faux) → **non révocables via l'app**. Décision Fiche 3 déjà prise :
  COMPTER au snapshot ; si 0 actif → rien à faire. **Action de ce lot = compter** (lecture prod
  seule, hors fenêtre d'écriture), pas coder. 🟢 si 0.

**→ Si tu confirmes cette lecture, ① et ② ne sont plus des chantiers de code — juste un comptage
(②-résidu) et une décision sur le spam d'accusés (①-résidu). Le poids du lot se déplace sur ③④⑤.**

---

## ③ A7-C2 / A7-C4 — cycle de vie du lien (INSTRUIRE, ne pas trancher)

**A7-C4 — destinataire Nounou immortel : confirmé, et c'est le plus simple.**
`useNounou.ts:283` définit `removeDest(id)` — **aucun composant ne l'appelle** (`grep` : zéro
`removeDest` hors du store et de son type). Côté Cuisine, « Retirer » existe (mini-lot F1) et coupe
le lien ; côté Nounou, **rien** ne retire une personne. Asymétrie pure.
- **Option** : câbler le geste Nounou sur `removeDest` **+ `revokeEspace`** (le même honnête que F1)
  → une personne Nounou se retire comme une personne Cuisine. **🟢 S** (l'UI existe, la logique
  existe, il manque le bouton + le fil serveur). C'est le vrai « prérequis levé » qui manque à A7.
- **Porte** : test « `removeDest` a au moins un appelant UI » (miroir du verrou langue) + smoke.

**A7-C2 — le token survit au renommage : confirmé, mais c'est une DÉCISION, pas un bug.**
`PartageSheet.saveEdit` (Cuisine) et l'édition Nounou **conservent `token`** au renommage : renommer
« Fatima » en « Aicha » **garde le même lien** — donc l'ancienne Fatima, si elle a le lien, lit
toujours la page de la nouvelle Aicha. Faille **symétrique** Cuisine + Nounou. Les options et leur
coût (je n'en tranche AUCUNE — c'est ta décision au STOP) :

| Option | Ce que ça achète | Coût | Prix caché |
|---|---|---|---|
| **Rotation au renommage** — un renommage émet un nouveau token, l'ancien meurt | Le renommage = « nouvelle personne » (aligné D1 couper/créer) | 🟡 M | Le lien change → il faut le **re-partager** ; contredit l'invariant « un lien durable ». À conjuguer avec le garde-fou passif D11 (le renommage honnête reste libre) |
| **Expiration** — tout lien meurt après N jours d'inactivité | Borne le vol dans le temps sans geste | 🟡 M | Table `espaces` gagne `expires_at` + un balayage (cron/RPC) ; une page « expirée » qu'on lit encore par cache (cf. ④) ment ; **fenêtre token** |
| **PIN** — le destinataire saisit un code à la 1ʳᵉ ouverture | Le lien seul ne suffit plus (vol de lien ≠ accès) | 🔴 L | Friction sur le personnel (souvent peu à l'aise) ; stockage du PIN (hash) ; récupération ; casse « sans compte, un tap » |
| **Statu quo + « Retirer » explicite** | Le geste de coupure existe déjà (F1/C4) ; le renommage n'est PAS une coupure | 🟢 0 | Ne répond pas au vol de lien passif — repose sur l'humain qui retire |

**Ma lecture (pour éclairer, pas pour décider)** : le vrai risque A7-C2 n'est pas le renommage en
soi, c'est **« un lien distribué reste valide pour toujours »**. La rotation le règle au prix de
l'invariant ; l'expiration le borne sans geste mais bute sur le cache (④). Le PIN est le seul vrai
rempart au **vol** de lien, au prix le plus lourd pour l'usage. **Décide le curseur ; je chiffre
finement l'option retenue au GO.**

---

## ④ Purge du cache d'une page révoquée — « couper le passé ou seulement le futur ? »

**Trou réel, côté CLIENT (le seul de la liste que le durcissement serveur ne couvre pas).**
`EspaceView.tsx:23-44` : `readEspace` renvoie `null` quand la ligne `espaces` a été **supprimée**
(révoquée par F1). Or le code, sur `null`, **retombe sur le cache** :
```ts
} else {                          // pas de contenu en ligne
  const cached = readCache(token);
  if (cached) { setEspace(cached); setState('ok'); }   // ← sert la page RÉVOQUÉE
```
→ **Une page révoquée continue de s'afficher** sur l'appareil qui l'avait déjà ouverte (le
`localStorage` la garde). F1 a rendu la révocation honnête *côté serveur* ; le cache est le trou
*côté appareil*. La révocation coupe le futur (nouvelles ouvertures = `empty`), **pas le passé**.

**La question que tu poses est la bonne, et elle a deux réponses possibles** :
- **Couper le futur seulement (🟢 S)** : distinguer `null-révoqué` (la ligne a existé, elle n'existe
  plus → **purge le cache** + écran « ce lien a été retiré ») de `null-jamais-vu` et de
  `offline-avec-cache` (là, le cache reste — c'est l'offline légitime). Le point dur : `readEspace`
  renvoie `null` pour « supprimé » ET pour « offline/erreur » — il faut les **séparer** (une ligne
  supprimée = requête réussie, 0 row ; offline = requête échouée). Le code a déjà les deux branches
  (`.then` vs `.catch`) — c'est dans le `.then(null)` qu'on purge, jamais dans le `.catch`.
- **Couper le passé aussi (🔴, hors Ambition A)** : invalidation active (push/TTL du cache). Lourd,
  pas nécessaire si on accepte « le cache offline survit jusqu'à la prochaine ouverture en ligne ».
- **Porte** : test unitaire sur la machine à états (`null` réussi → purge + écran retiré ;
  `.catch` avec cache → sert le cache) + smoke : révoquer → ré-ouvrir en ligne → « lien retiré ».

**Ma recommandation** : couper le futur proprement (🟢), c'est ce que « Retirer » promet à
l'employeur. Couper le passé (appareil hors-ligne détenant un cache) est un cas rare qui coûte cher.

---

## ⑤ Reliquat `create_foyer` + anti-abus edge

**`create_foyer` encore `authenticated` — spam de foyers.** `0005:11` le note explicitement
(« Le spam `create_foyer` part dans le lot Assainissement » = ce lot). État : `SECURITY DEFINER`,
appelable par tout authentifié ; le **garde-fou existe déjà** en dur : `membres.unique(user_id)`
(`0001:25`, « un utilisateur = un seul foyer ») → un 2ᵉ `create_foyer()` du même user **échoue sur
la contrainte**. Donc le « spam » est borné à **1 foyer par compte** ; le coût résiduel = des lignes
`foyers` orphelines si l'insert foyer réussit avant l'échec membre (transaction : non — c'est un seul
`plpgsql`, ça rollback). **Risque réel : faible.** Option : ajouter `if exists(membre) then raise`
en tête pour un échec *propre* (message clair au lieu d'une violation de contrainte). **🟢 S**,
fenêtre token (fonction `definer`). **À trancher : est-ce que ça vaut la fenêtre, ou on classe ?**

**Anti-abus edge — déjà solide, je le confirme (pas de trou).** `generate-recipe/index.ts:181` :
401 sans JWT, `getUser` vérifié, foyer résolu, `reserve_ai_usage` **atomique** (0004, plafond
`AI_CAP`) ; estimate/translate passent par `reserve_abuse_guard` (0005, plafond 1000, session
exigée, **pas de refund** = un script en boucle atteint le plafond plus vite). `invite` : max 5
actives (429). **Rien à durcir ici** — je le note pour que l'audit soit complet, pas pour coder.

---

## ⑥ RGPD / loi 09-08 — complétude du registre

`RGPD.md` est un **gabarit d'implémenteur** solide (politique, rétention, sous-traitants, droits) —
le contenu final (société, e-mail, DPA) te revient. **Trous de complétude que ce lot peut fermer
côté produit** (le juridique reste à toi) :
- **La ligne « allergies → relais IA »** (rédigée à la clôture Cuisine C1) n'est **pas encore dans
  `RGPD.md`** — elle vit au DEVLOG. → la **porter au registre** (§1 tableau des traitements) : donnée
  de santé potentielle transitant vers Anthropic, non stockée. **🟢 doc.**
- **Le registre ne liste pas `espace_opens`** (accusés de lecture = horodatage + jeton) ni le
  **remappage langue** (donnée de préférence). Compléter le tableau. 🟢 doc.
- **Cohérence rétention ↔ ④** : la ligne « pages publiées → expiration à instruire (§4) » dépend de
  ta décision ③/④. Une fois ③ tranché, `RGPD.md §2` se fige. 🟢 doc, **après ③**.
- **Manque : le sort du cache local `espace:<token>`** (localStorage de l'appareil du personnel) —
  à mentionner dans la politique (données lues hors-ligne, effacées à…). Lié à ④. 🟢 doc.

---

## Ce que TA LISTE ne rate pas (mais que je dois signaler)

Un seul candidat « trou béant » hors liste, et je le classe **hors Ambition A** (tu l'as cadré) :
l'**accusé de lecture inséré en anon** (①-résidu) est aussi un vecteur d'**énumération faible** — qui
détient un jeton peut confirmer qu'il est vivant en insérant un open et en le relisant… sauf que la
relecture est fermée (0006). Donc **non exploitable** pour l'énumération. Rien d'autre de béant sous
Ambition A : les fuites d'isolation structurelles ont été fermées par AS-2. Le reste (chasse
offensive systématique — injection SQL, XSS sur le contenu partagé, CSP, headers) est **Ambition B**,
explicitement après, pour le lancement public.

---

## Découpage proposé & chiffrage global

| Tranche | Contenu | Chiffrage | Fenêtre token ? |
|---|---|---|---|
| **T1** | ④ purge cache page révoquée (couper le futur) + C4 câblage « Retirer » Nounou | 🟢 S+S | Non (client pur) |
| **T2** | ③ A7-C2 — l'option que TU retiens (rotation / expiration / PIN / statu quo) | 🟡 selon option | Selon option (expiration = oui) |
| **T3** | ①-résidu (spam accusés) + ⑤ `create_foyer` propre | 🟡 | **Oui** (RLS/RPC prod) — groupée, une seule fenêtre |
| **T4** | ⑥ registre RGPD (après ③) + ②-résidu (comptage legacy, lecture prod) | 🟢 doc | Non (comptage = lecture seule) |

**Ordre logique** : T1 (client, zéro risque) → T3 (la fenêtre token, une seule) → T2 (dépend de ta
décision ③) → T4 (doc, fige après ③). **Mais je ne présume rien** — tu ordonnes au GO.

## Questions au GO (4)

1. **① et ② fermés par AS-2** — confirmes-tu ma lecture ? (sinon, montre-moi ce que je rate). Si oui,
   le lot se réduit aux résidus + ③④⑤⑥.
2. **③ A7-C2** — quel curseur ? (rotation au renommage · expiration · PIN · statu quo + Retirer). Je
   chiffre finement l'option retenue ; je NE code rien avant.
3. **⑤ `create_foyer`** — vaut-il la fenêtre token pour un échec *propre* (le spam est déjà borné à
   1/compte par `unique(user_id)`), ou on classe « borné, acceptable » ?
4. **①-résidu spam d'accusés** — on borne (RPC/policy, fenêtre token), ou on classe (nuisance, pas
   fuite) ? Rappel : « Dernier accès » est best-effort, déjà toléré faillible.

**⏸ STOP read-back — j'attends tes décisions. Aucun correctif écrit.**
