# Paquet RGPD / vie privée — Manzil (S7)

> **Gabarit d'implémenteur** — la structure et les éléments techniques sont posés ; le
> **contenu final (mentions légales, coordonnées, société) revient à Amine**. Ce n'est
> **pas un avis juridique** : à faire relire par un conseil avant publication.
> Cadre : **loi 09-08 (CNDP, Maroc)** en premier, **RGPD** en surplus pour la diaspora UE
> (cf. `DECISIONS_STORE_V1.md` D8). Base de conformité n°1 = **local-first** (minimisation).

---

## 1. Politique de confidentialité (FR) — gabarit à compléter

**Responsable de traitement.** [Nom société / éditeur], contact **[email de contact]**.
Pour les foyers de l'UE, [représentant UE si requis].

**Ce qu'on collecte et pourquoi.**
| Donnée | Finalité | Base légale |
|---|---|---|
| E-mail (compte Manzil) | Créer le compte, connexion (OTP), sauvegarde | Exécution du service / consentement |
| Contenu du foyer (recettes, menus, destinataires, fiches sécurité, doc nounou, réglages) | Fournir l'app, sauvegarder, synchroniser entre appareils | Exécution du service |
| Notes vocales | Fonction « voix = référence » ; sauvegarde (bucket privé) | Exécution du service |
| Pages publiées (`espaces`) | Partager un espace au personnel via lien à jeton | Intérêt légitime / consentement de l'auteur |
| Quota IA (`ai_usage`) | Limiter les coûts, prévenir l'abus | Intérêt légitime |

**Ce qu'on NE fait PAS.** Aucune analytics sur le **contenu** des pages ; pas de revente ;
pas de profilage publicitaire. (Crash-reporting technique via Sentry, sans donnée de contenu.)

**Hébergement & sous-traitants.**
- **Supabase** (base + auth + stockage) — région **UE** (à confirmer / migrer, cf. `DECISIONS` QA).
- **Cloudflare Pages** (hébergement web).
- **Anthropic** (génération/traduction IA) — appelée **serveur**, sur le texte de recette soumis.
- **Sentry** (crash-reporting technique).
→ Prévoir un **DPA** (accord de sous-traitance) signé avec chacun (Supabase & Cloudflare & Sentry & Anthropic proposent des DPA standard).

**Sécurité.** Cloisonnement par foyer (**RLS** stricte, vérifiée), chiffrement **au repos** et
**en transit** (fourni par Supabase/Cloudflare), quotas/écritures sensibles côté **serveur**.

**Tes droits (exerçables dans l'app).** Accès & **export** (bouton « Exporter mes données »),
**suppression** (« Supprimer mon compte » → efface compte + foyer + contenu), **portabilité**
(export JSON). Rectification = édition directe. Pour toute demande : **[email de contact]**.

**Liens reçus par le personnel.** Un espace partagé est lu par **lien à jeton** non deviné,
**sans compte**. Un lien peut être **transféré** → voir §4 (options PIN/expiration à l'étude).

**Enfants.** L'app contient des données concernant des enfants **saisies par le parent**
(exemption domestique côté parent ; **Manzil reste responsable de traitement** en tant
qu'hébergeur). Pas de compte enfant, pas de collecte directe auprès d'un mineur.

**Modifications.** [Date de dernière mise à jour] · les changements notables seront signalés.

---

## 2. Rétention (proposée)

| Donnée | Conservation | Suppression |
|---|---|---|
| Compte + contenu foyer | Tant que le compte existe | Immédiate à la suppression de compte (cascade) |
| Pages publiées (`espaces`) | Jusqu'à révocation / suppression du foyer (**cascade**, 0002) | + **expiration** à instruire (§4) |
| Notes vocales (bucket privé) | Idem contenu foyer | Purge à la suppression du foyer |
| **Tombstones de sync** (`docs.deleted_at`) | **À purger** après ~[90] jours | Tâche de purge périodique (à écrire) |
| `ai_usage` | Par mois glissant | Purge des mois anciens (facultatif) |
| Logs Sentry | Rétention par défaut Sentry (à régler court) | — |

**À écrire** : une purge périodique des **tombstones** (`docs` où `deleted_at < now()-90j`) et,
si retenu, des **espaces expirés**. (Non bloquant au lancement ; à planifier.)

---

## 3. Checklist conformité (avant lancement public)

- [ ] **Région UE** confirmée sur Supabase (sinon migration — `DECISIONS` QA).
- [ ] **DPA** signés : Supabase · Cloudflare · Sentry · Anthropic.
- [ ] **RLS** activée + **testée** sur toutes les tables (fait : isolation foyer vérifiée 9/9).
- [ ] Chiffrement au repos confirmé (Supabase) ; HTTPS partout (fait).
- [ ] **Politique de confidentialité** publiée (FR) + lien dans l'app.
- [ ] **Export** + **suppression de compte** in-app (faits : S2/S6).
- [ ] Rétention **tombstones** définie + purge planifiée.
- [ ] Sentry : `sendDefaultPii:false`, aucun contenu (fait) ; rétention courte réglée.
- [ ] Secrets jamais commités (`service_role`, `ANTHROPIC_API_KEY`) — vérifié.
- [ ] Registre des traitements (art. 30 RGPD) rédigé ; déclaration/formalités **CNDP** (loi 09-08) au Maroc.

---

## 4. Note d'options — liens reçus (PIN / expiration) — À INSTRUIRE, pas implémenté

Un lien `#e=` est **public par jeton** et **transférable** (un WhatsApp se réachemine).
Options à peser (aucune retenue pour l'instant) :
- **Expiration** : `espaces.expires_at` + refus de lecture au-delà (simple, recommandé à terme).
- **PIN optionnel** : code court demandé à l'ouverture (protège un transfert non voulu ; friction pour le personnel).
- **Révocation manuelle** : déjà possible via la suppression du foyer (cascade) ; UI de révocation par lien = backlog (RLS auteur, cf. 0002).

Recommandation : commencer par **expiration configurable** (faible friction) ; PIN seulement si un besoin réel émerge.

---

> **Statut** : gabarit posé (structure + technique). **À faire par Amine** : compléter les
> mentions (société, contact, dates), faire relire juridiquement, signer les DPA, publier la
> politique et la lier dans l'app. Les briques techniques (export, suppression, RLS, cascade,
> quota serveur) sont **en place**.
