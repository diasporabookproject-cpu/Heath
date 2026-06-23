# PASSATION CLAUDE CODE — « Maison OS » *(nom de travail)* — Lot v1

> **À quoi sert ce document.** Le donner à Claude Code pour exécution. Il reprend
> l'état complet décidé en chat produit : décisions verrouillées, contraintes dures,
> ordre de construction, et les **fiches prêtes à implémenter** (format §8 de
> `PRODUCT_CONTEXT.md`). Compléments : `PRODUCT_CONTEXT.md` (passation/source de
> vérité), `MANIFESTE_PRODUIT.md` (vision/invariants), `BRIEF_PRODUIT.md` (détail
> Cuisine), `DEVLOG.md` (journal technique).
>
> **Boucle attendue :** Claude Code chiffre (🟢 rapide / 🟡 moyen / 🔴 lourd),
> implémente, déploie, renvoie un **résultat réel** (lien, capture, limites), consigne
> dans `DEVLOG.md`. Si un choix « rapide » risque de bloquer la montée en charge future,
> **le signaler** et arbitrer.

---

## 0. Cadre — POC à finition conceptuelle avancée

On teste vite le **concept**, à un niveau de finition **conceptuel** avancé. L'actif
durable est le **concept éprouvé** (reproductible ensuite pour la code base finale),
**pas** le code de ce POC. Conséquence pour les choix :
- Privilégier **concepts propres** (Fiche, Plan, Personne/Destinataire, Brief) et
  **contenu portable** (exports/imports JSON propres) — ils survivent à un éventuel rewrite.
- **Pas** de multi-tenancy de production, pas de sur-ingénierie dans ce POC.
- Nommer ce qui est jetable pour que ça ne devienne pas permanent par accident.

---

## 1. Contraintes dures (toutes fiches)

- **Offline-first** : marche sans réseau ; données d'abord sur l'appareil.
- **Le personnel n'a pas l'app** → sorties partageables : **lien lecture-seule, WhatsApp,
  QR/impression, note vocale**.
- **Multilingue** : UI en français ; **darija en lettres arabes (RTL)** pour le personnel ;
  mécanisme agnostique au nombre de langues.
- **Hébergement statique** (GitHub Pages) ; seul backend = **Supabase** ; logique serveur
  = **edge functions** uniquement (ex. relais IA).
- **Confidentialité** : données privées du foyer ; sensibilité maximale module Sécurité enfants.
- **Médical Cuisine** : 100 % sans gluten ; calcium = enjeu n°1 (visible partout) ; cibles
  kcal par type de jour (Repos 1720 / Cardio 1880 / Muscu 1950) ; collation + kéfir toujours
  comptés ; feux tricolores (kcal ±10/20 %, protéines ≥150/130, calcium ≥1000/850) ;
  **ne pas normaliser càc/càs**.
- **Sécurité** : **aucune génération IA** de contenu sécurité ; l'app est le réceptacle des
  consignes des parents, pas un conseiller.

---

## 2. Registre de décisions (verrouillées)

- **D1** — Personnel en **lecture seule** en v1 ; retour (« fait »/« manque ») différé.
- **D2** — Thèse de marché / positionnement / prix / **nom** : plus tard, conversation dédiée.
- **D3** — Tenir un **Manifeste Produit vivant**.
- **D4** — v1 = **POC potentiellement jetable** ; protéger apprentissages + contenu portable, pas le code.
- **D5** — POC à **finition conceptuelle avancée** ; actif durable = concept éprouvé ; pas de multi-tenancy prod.
- **D6** — Ordre des modules : **Cuisine → Sécurité-référentiel → Entretien → Enfants-planning** ; synchro multi-appareils différée.
- **D7** — Cold-start : **seed maintenant** ; **IA in-app à tester vite, petite échelle** ; **IA exclue de la génération sécurité**.
- **D8** — Fiche « Langue de lecture par destinataire » : format validé.
- **D9** — **IA in-app autorisée à l'échelle POC** (faible risque tant que non diffusé) ; relais **edge function** ; **humain dans la boucle** ; **exclue de la Sécurité**.
- **D10** — Véhicule du test IA = **recettes** (Cuisine).
- **D11** — Traduction du contenu **sécurité** = **IA avec relecture parent obligatoire** ; **note vocale du parent (sa voix) = canal de référence** pour la sécurité, le texte traduit n'étant que la couche de confort.
- **D12** — Sécurité v1 = **numéros d'urgence + procédures + gestes permis/interdits** ; routines récurrentes différées.
- **D13** — Accès = **plancher WhatsApp / plafond PWA** ; l'installation est un **bonus, pas une dépendance** (dégradation gracieuse).

---

## 3. Ordre de construction

- **Groupe 1 — Maintenant (keystone d'accès)** : **F1 Espace permanent + accès** et
  **F2 Langue par destinataire** (la langue est une propriété de l'espace). F2 sous-tend
  le rendu « dans sa langue » de F1 et F3.
- **Groupe 2 — Maintenant (le wedge)** : **F3 Module Sécurité-référentiel v1** + **F4 Seed
  sécurité**. Leur *livraison* passe par l'espace de F1.
- **Groupe 3 — Bientôt** : **F5 Génération assistée de recette (test IA in-app)** — nécessite
  la 1re edge function (relais IA réutilisable).

**Hors v1 (différé)** : retour/write-back du personnel ; synchro multi-appareils ; IA in-app
au-delà du test recette ; routines récurrentes / planning enfants ; PIN sur section sécurité ;
push notifications ; photos/vidéos hébergées à grande échelle.

---

## 4. Fiches prêtes à implémenter

### F1 — Espace personnel permanent + accès (plancher WhatsApp / plafond PWA)
```
TITRE : Espace personnel permanent + accès sans installation (plancher WhatsApp / plafond PWA)
TYPE : Fonctionnalité (Technique : lien capability tokenisé + PWA installable + cache offline + edge pour « lu »)
MODULE : Transverse (keystone d'accès ; sert Cuisine + Sécurité)
OBJECTIF / POURQUOI : Donner au personnel un accès permanent, sans friction, sans app store et
  hors-ligne à SON espace, dans sa langue — SANS jamais miser la disponibilité sur une installation
  fragile. Lève le risque n°1 (boucle de transmission) côté accès, avec dégradation gracieuse.
PRINCIPE D'ACCÈS (structurant) :
  - PLANCHER (marche toujours, zéro install) = WhatsApp. L'éphémère (menu du jour) part en messages
    + notes vocales. Le contenu permanent (sécurité) peut être poussé UNE FOIS en message+voix comme
    filet dégradé.
  - PLAFOND (meilleure expérience) = icône PWA. Espace permanent structuré (références durables :
    sécurité, standards + brief courant), offline, mis à jour en place, avec « lu/ouvert ».
  - L'installation est un BONUS, pas une dépendance : le produit (surtout sécurité) reste utile sans elle.
COMPORTEMENT ATTENDU :
  - L'admin génère pour un destinataire UN lien permanent + un QR imprimable.
  - Idéal (onboarding en personne) : l'admin pose l'icône sur le téléphone du personnel en ~1 min
    (ouvrir le lien → Ajouter à l'écran d'accueil → renommer dans la langue de la personne).
  - À distance / si l'install échoue : aide à l'installation in-page illustrée dans la langue ; sinon
    le personnel reste couvert par WhatsApp (texte+voix) + QR papier.
  - Ensuite : la personne ouvre l'icône → son espace, hors-ligne, dans sa langue (RTL si darija),
    notes vocales ▶️.
  - L'admin met à jour le contenu EN PLACE ; notification = ping WhatsApp manuel (« menu prêt »),
    pas de push.
OÙ : gestion des destinataires (génération lien + QR) ; page publique de l'espace (lecture seule).
RÈGLES MÉTIER :
  - Accès = capability URL (jeton long non devinable), PAS de login.
  - Rotation : révoquer + réémettre → l'ancien lien meurt (turnover du personnel).
  - PWA + cache offline : espace consultable sans réseau après 1re ouverture.
  - « Ouvert/lu » loggé quand réseau (ouvertures offline synchronisées au retour).
  - Langue du destinataire (cf. F2) ; càc/càs non normalisés.
  - Android prioritaire ; QR papier couvre les écarts iOS.
CAS LIMITES :
  - 1re ouverture sans réseau → faire l'install en WiFi ; QR papier comme secours immédiat.
  - iOS (offline limité) → plancher WhatsApp + QR compensent.
  - Lien fuité → jeton non devinable + rotation ; (PIN sécurité = v2).
  - Nouveau téléphone / cache vidé → réinstaller via QR ou renvoi du lien ; WhatsApp reste le filet.
  - Contenu non traduit → fallback langue + mention.
CRITÈRE DE « FINI » : En onboarding je pose l'icône sur le téléphone de Fatima en ~1 min ; le
  lendemain hors-ligne elle ouvre l'icône → sécurité + menu du jour + notes vocales en darija. Si
  l'install n'a pas eu lieu, elle a quand même reçu le menu et la sécurité sur WhatsApp et via le QR
  du frigo. Fatima part : je révoque, l'ancien lien ne donne plus rien.
PRIORITÉ : Maintenant (keystone ; conditionne la livraison de Sécurité).
```

### F2 — Langue de lecture par destinataire
```
TITRE : Langue de lecture par destinataire
TYPE : Fonctionnalité (Technique légère : entité « destinataire » + champ langue)
MODULE : Transverse (1re mise en œuvre côté Cuisine, réutilisée par Sécurité)
OBJECTIF / POURQUOI : Chaque membre du personnel reçoit ses briefs dans SA langue native sans
  réglage manuel à chaque partage. Réduit la friction de la boucle de transmission (risque n°1).
  Introduit l'objet « destinataire », réutilisable par tous les modules — concept propre qui
  survit à un rewrite.
COMPORTEMENT ATTENDU :
  - L'admin crée/édite un « destinataire » : nom + rôle indicatif (cuisinière/ménage/nounou) +
    langue de lecture préférée + canal (WhatsApp/lien).
  - À la transmission, l'espace + le texte à copier + les notes vocales s'affichent automatiquement
    dans sa langue (RTL si darija).
  - Surcharge ponctuelle possible de la langue pour un partage donné.
OÙ : écran de partage / Vue Cuisinière (1re instance) ; écran simple de gestion des destinataires.
RÈGLES MÉTIER :
  - Langues live à la livraison : Français + الدارجة (déjà supportées). Mécanisme agnostique au
    nombre de langues ; ajouter une langue = fournir le contenu traduit. Anglais activé dès que le
    contenu anglais existe.
  - Contenu absent dans la langue → fallback Français + mention « non disponible en [langue] ».
  - RTL obligatoire pour darija. Ne pas normaliser càc/càs.
CAS LIMITES :
  - Destinataire sans langue définie → défaut Français.
  - Note vocale absente dans la langue → afficher le texte, pas de fallback audio.
  - Hors-ligne → langue préférée disponible sans réseau (donnée locale).
  - Contenu partiellement traduit → afficher l'existant, marquer les manques.
CRITÈRE DE « FINI » : Je crée « Fatima = darija », je lui partage le menu en un tap ; elle voit tout
  en darija (RTL) avec les notes vocales, sans que j'aie réglé la langue. Je crée « Nanny = anglais » ;
  tant que le contenu anglais n'existe pas, elle voit le fallback français avec la mention.
PRIORITÉ : Maintenant (avec F1 ; pré-requis du rendu « dans sa langue »).
```

### F3 — Module Sécurité-référentiel v1
```
TITRE : Module Sécurité — référentiel des consignes du foyer (v1)
TYPE : Fonctionnalité (réutilise le motif Référentiel → Transmettre)
MODULE : Enfants-Sécurité (volet Sécurité statique ; planning/routines différé)
OBJECTIF / POURQUOI : Donner au personnel (nounou en priorité) un accès permanent, fiable et dans
  sa langue aux consignes de sécurité du foyer, saisies par les parents. Wedge commercial (« je
  sécurise mon foyer ») + faible complexité (fiches statiques). L'app est le réceptacle des consignes
  des parents, pas un conseiller.
COMPORTEMENT ATTENDU :
  - L'admin crée des fiches Sécurité de 3 sous-types : Numéros d'urgence ; Procédures d'urgence ;
    Gestes permis/interdits.
  - Chaque fiche : titre, contenu structuré (étapes pour une procédure ; liste pour les gestes ;
    contacts pour les numéros), statut (Validé/Test/Archivé), note vocale optionnelle (voix du parent).
  - Les fiches Validées apparaissent dans l'espace permanent des destinataires concernés (F1),
    toujours accessibles, hors-ligne, dans leur langue, RTL si darija.
  - Mise à jour en place : modifier une consigne se reflète dans l'espace sans renvoyer de lien.
OÙ : nouvelle section « Sécurité » du référentiel (admin) ; rendu dans l'espace permanent (personnel).
RÈGLES MÉTIER :
  - AUCUNE génération IA du contenu sécurité (D7). Contenu = parents (ou templates seed rédigés par
    humain, relus parent).
  - Traduction par IA AUTORISÉE mais relecture parent OBLIGATOIRE avant Validé (D11).
  - Note vocale du parent (sa voix) = canal de référence ; texte traduit = couche de confort (D11).
  - Numéros d'urgence : secours locaux + contacts foyer ; toujours visibles en tête.
  - Routines récurrentes / planning enfants : HORS v1.
CAS LIMITES :
  - Fiche non traduite dans la langue du destinataire → fallback + mention (F2).
  - Hors-ligne → fiches Validées consultables sans réseau.
  - Contenu sensible/erroné → statut Test tant que non relu ; jamais Validé automatiquement.
  - Destinataires multiples (ex. deux nounous) → mêmes fiches, chacune dans sa langue.
CRITÈRE DE « FINI » : Je saisis les numéros d'urgence, 4-5 procédures et la liste des gestes ; je les
  assigne à la nounou ; dans son espace (icône, hors-ligne, darija) elle voit les numéros en tête, ouvre
  une procédure étape par étape avec la note vocale de la maman, et la liste des gestes. Je corrige une
  consigne depuis mon téléphone : son espace reflète la mise à jour.
PRIORITÉ : Maintenant (après le keystone d'accès dont il dépend pour la livraison).
```

### F4 — Pack de démarrage Sécurité (seed)
```
TITRE : Pack de démarrage Sécurité (seed)
TYPE : Fonctionnalité / Contenu (réutilise l'import en lot existant)
MODULE : Enfants-Sécurité
OBJECTIF / POURQUOI : L'app Sécurité ne s'ouvre jamais vide → cold-start. Fournir des squelettes prêts
  à éditer (numéros types + procédures génériques + checklist de gestes) que le parent complète/valide.
  Attaque le risque n°2 sur le module le plus émotionnel.
COMPORTEMENT ATTENDU :
  - À l'activation du module, l'admin peut importer un pack de démarrage (fiches en statut Test).
  - Le parent revoit, complète (numéros locaux réels, spécificités du foyer) et passe en Validé.
OÙ : activation du module Sécurité ; mécanisme d'import JSON existant.
RÈGLES MÉTIER :
  - Seed = templates RÉDIGÉS PAR HUMAIN (pas par IA), car contenu sécurité (D7). Un seed importé n'est
    pas de la génération IA.
  - Numéros : placeholders locaux (à remplir) + champs contacts foyer.
  - Procédures : squelettes génériques (étouffement, brûlure, chute, allergie, fièvre, incendie,
    intoxication) à valider/adapter par le parent — jamais Validé sans relecture.
  - Traduction des seeds : IA avec relecture parent obligatoire (D11).
  - Contenu seed portable (JSON propre) pour survivre à un rewrite (D5).
CAS LIMITES :
  - Parent n'édite pas → contenu reste en Test, exclu de l'espace (pas de consigne non validée affichée
    comme officielle).
  - Numéros locaux variables selon pays/ville → placeholders explicites.
CRITÈRE DE « FINI » : J'active Sécurité, j'importe le pack ; je vois des squelettes en Test ; je remplis
  les vrais numéros et j'adapte 2 procédures ; après validation, elles apparaissent dans l'espace de la
  nounou. Rien de non validé n'est visible côté personnel.
PRIORITÉ : Maintenant (avec F3).
```

### F5 — Génération assistée d'un brouillon de recette (test IA in-app)
```
TITRE : Génération assistée d'un brouillon de recette (test IA in-app)
TYPE : Fonctionnalité (Technique : edge function Supabase = relais LLM, seul morceau de logique serveur,
  réutilisable pour tout appel IA futur)
MODULE : Cuisine (véhicule de test) ; brique IA réutilisable Transverse
OBJECTIF / POURQUOI : Tester l'IA in-app à l'échelle POC (cheap, peu risqué tant que non diffusé) ET
  nourrir le cold-start. Cuisine choisie car elle teste le respect de contraintes dures (sans gluten +
  cible calcium + macros) et la qualité darija — le signal le plus fort.
COMPORTEMENT ATTENDU :
  - Dans la bibliothèque, bouton « Générer un brouillon » : l'admin donne une intention (ex. « dîner
    sans gluten riche en calcium, ~600 kcal ») + contraintes.
  - L'app appelle le LLM via l'edge function ; renvoie un brouillon (nom, ingrédients pesés, macros
    estimées) en statut « Test » par défaut.
  - Humain dans la boucle OBLIGATOIRE : l'admin relit/corrige (surtout macros et càc/càs) puis passe en
    « Validé ». Rien de généré n'est « Validé » automatiquement.
OÙ : bibliothèque de recettes (Cuisine).
RÈGLES MÉTIER :
  - Clé API JAMAIS dans le front → uniquement via edge function.
  - Sortie en statut Test, exclue des choix de menu tant que non validée.
  - Macros marquées « estimées IA » jusqu'à validation humaine.
  - « Sans gluten » rappelé dans le prompt ; càc/càs conservés.
  - Exclusion : AUCUNE génération IA pour le module Sécurité (D7/D9).
CAS LIMITES :
  - Hors-ligne → bouton indisponible ; le reste de l'app marche normalement.
  - Réponse hors-format/incohérente → afficher en Test éditable, ne jamais bloquer la saisie manuelle.
  - Darija douteuse → l'admin édite ; signal collecté pour juger la qualité.
  - Coût → usage foyer, volume faible ; à surveiller si diffusion élargie.
CRITÈRE DE « FINI » : Je génère un brouillon de dîner sans gluten ; il arrive en Test avec ingrédients
  pesés et macros estimées ; je corrige le calcium et valide ; il devient disponible dans le sélecteur de
  menu. Une version darija lisible est produite (qualité jugée à la relecture).
PRIORITÉ : Bientôt (nécessite la 1re edge function — investissement réutilisable).
```
