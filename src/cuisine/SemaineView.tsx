import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { dayHasAny, mealHasAny, mealHasDraft } from '../lib/menu';
import type { DayMenu, MealKey } from '../types';
import { weekDatesOffset, weekSub, dayLabel } from './dates';
import { IconChevL, IconChevR, IconStar, IconCopy, IconShareUp } from './icons';
import { recipeEmoji } from '../lib/emoji';
import Em from '../ui/Em';
import PlatPhoto from './PlatPhoto';
import { pickHeroKey, nowHHMM } from './hero';

// T3 (lot UI) : 4 moments, libellés alignés Menu ↔ page reçue (SPEC 3 —
// les clés du modèle, du digest et de la projection ne bougent pas).
const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Petit déjeuner', dej: 'Déjeuner', gouter: 'Goûter', diner: 'Dîner' };
/** Libellés de TUILE (refonte T1 : « Petit déj » court sur les vignettes/états vides). */
const MEAL_TILE: Record<MealKey, string> = { petitdej: 'Petit déj', dej: 'Déjeuner', gouter: 'Goûter', diner: 'Dîner' };
/** Emoji de MOMENT (décoration des tuiles + état vide, refonte T1). Distinct du
 *  dictionnaire déterministe des PLATS (`recipeEmoji`) : ici c'est le CRÉNEAU.
 *  Aligné maquette (déj = 🍽️, goûter = 🍎). Tous embarqués dans le jeu Fluent. */
const MOMENT_EMOJI: Record<MealKey, string> = { petitdej: '🥐', dej: '🍽️', gouter: '🍎', diner: '🌙' };
const MEAL_KEYS: MealKey[] = ['petitdej', 'dej', 'gouter', 'diner'];

// F1.2 (lot Cuisine, accord PO) : « Générer la semaine » est RETIRÉ — « proposer
// un repas » part au backlog. Le garde-fou F5b (biblio vide → proposer la
// collection), qui ne servait que ce bouton, meurt avec lui (réconcilié avec le
// rapport Q&A 338abfb au read-back). Le rail Collections reste la voie d'entrée.

interface Props {
  voiceIds: Set<string>;
  /** DA v2 (T2) — vue courante : jour (bande de jours) ou semaine (bouton dédié). */
  view: 'jour' | 'semaine';
  /** Index (0 = lundi) du jour sélectionné dans la semaine AFFICHÉE. */
  dayIdx: number;
  onSelectDay: (i: number) => void;
  onToggleWeek: () => void;
  onShare: () => void;
  onOpenMeal: (dayKey: string, meal: MealKey) => void;
  onCopyWeek: () => void;
  onGoValidate: () => void;
  toast: (m: string) => void;
}

export default function SemaineView({ view, dayIdx, onSelectDay, onToggleWeek, onShare, onOpenMeal, onCopyWeek, onGoValidate, toast }: Props) {
  // Retour device PO (lot UI n°4) : « Copier UNE journée précédente » — la
  // source se CHOISIT (mini-feuille), plus d'automatisme silencieux.
  const [copyPick, setCopyPick] = useState(false);
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const weekOffset = useStore((s) => s.weekOffset);
  const navWeek = useStore((s) => s.navWeek);
  const copyDayInto = useStore((s) => s.copyDayInto);

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const dates = useMemo(() => weekDatesOffset(weekOffset), [weekOffset]);
  const weekEmpty = useMemo(
    () => !SEED_CONFIG.jours.some((j) => week.days[j.key] && dayHasAny(week.days[j.key])),
    [week.days],
  );

  const toValidate = useMemo(() => {
    const ids = new Set<string>();
    for (const j of SEED_CONFIG.jours) {
      const d = week.days[j.key];
      for (const k of MEAL_KEYS) {
        const m = d[k];
        if (!m) continue; // jour d'un client ancien : pas de clé `gouter`
        for (const id of [m.plat, m.entree, m.acc?.id]) {
          if (!id) continue;
          const r = byId.get(id);
          if (r && r.statut === 'Test') ids.add(id);
        }
      }
    }
    return ids.size;
  }, [week.days, byId]);

  // Le point « aujourd'hui » ne se montre que sur la semaine courante.
  const todayIdx = (new Date().getDay() + 6) % 7;
  // Repère « maintenant » figé au rendu (choix du repas héros). Pas de timer : un
  // passage d'heure pendant qu'on fixe l'écran sans rien toucher est un bord assumé.
  const heroNow = nowHHMM();

  // F7.2 amendement ① → retour PO n°4 : la source se CHOISIT. Candidats =
  // les jours NON VIDES de la semaine affichée, sauf le jour cible ; cible non
  // vide → confirmation explicite, jamais d'écrasement silencieux.
  const copyCandidates = SEED_CONFIG.jours
    .map((j, i) => ({ ...j, i }))
    .filter(({ key, i }) => i !== dayIdx && week.days[key] && dayHasAny(week.days[key]));

  const openCopyPick = () => {
    if (copyCandidates.length === 0) {
      toast('Rien à copier pour l’instant — compose ton premier repas');
      return;
    }
    setCopyPick(true);
  };

  const copyFrom = (srcKey: string, srcNom: string) => {
    const targetKey = SEED_CONFIG.jours[dayIdx].key;
    if (dayHasAny(week.days[targetKey]) && !window.confirm('Ce jour a déjà des repas — les remplacer ?')) {
      return;
    }
    copyDayInto(targetKey, week.days[srcKey]);
    setCopyPick(false);
    toast(`Journée copiée depuis ${srcNom}`);
  };

  /** Résumé d'un jour pour la feuille de choix (plats posés, dans l'ordre). */
  const dayResume = (key: string): string => {
    const day = week.days[key];
    const noms = MEAL_KEYS.map((k) => day[k]?.plat).filter(Boolean)
      .map((id) => byId.get(id as string)?.nom).filter(Boolean) as string[];
    return noms.length ? noms.join(' · ') : 'Repas sans plat';
  };

  // Vue JOUR (refonte T1, maquette) : carte-repas HÉROS (le prochain à servir —
  // dégradé + emoji Fluent par défaut, photo du plat si elle existe) + « le reste
  // de la journée » en tuiles ; journée vide → invitation (pas un formulaire). Le
  // geste de compo est INCHANGÉ : chaque zone reste `onOpenMeal` (vide → radial,
  // plein → composeur, routés au-dessus par CuisineView). `day[k]` peut manquer
  // (gouter d'un jour pré-T3) → `mealHasAny(undefined)` = vide.

  /** Résumé d'ingrédients de la carte héros (entrée + accompagnement, si présents). */
  const mealIngs = (meal: DayMenu[MealKey]): string => {
    const parts: string[] = [];
    if (meal?.entree) {
      const e = byId.get(meal.entree);
      if (e) parts.push(e.nom);
    }
    if (meal?.acc) {
      const a = byId.get(meal.acc.id);
      if (a) parts.push(a.nom);
    }
    return parts.join(' · ');
  };

  const heroCard = (jourKey: string, day: DayMenu, k: MealKey) => {
    const meal = day[k];
    const plat = meal?.plat ? byId.get(meal.plat) : undefined;
    const ings = mealIngs(meal);
    return (
      <button className={'cz-hero s-' + k} onClick={() => onOpenMeal(jourKey, k)}>
        <span className="ph">
          <span className="tg">{MEAL_LABEL[k]}</span>
          {plat ? (
            <PlatPhoto recipeId={plat.id} emoji={recipeEmoji(plat)} />
          ) : (
            <span className="emj"><Em ch={MOMENT_EMOJI[k]} size={44} /></span>
          )}
        </span>
        <span className="bd">
          <span className="nm">
            {plat ? plat.nom : 'Sans plat'}
            {plat && mealHasDraft(meal, k, byId) && (
              <span className="vio" title="à valider"><IconStar size={14} /></span>
            )}
          </span>
          <span className="mt">
            <span className="ings">{ings}</span>
            <span className="see">Voir →</span>
          </span>
        </span>
      </button>
    );
  };

  const restTiles = (jourKey: string, day: DayMenu, heroKey: MealKey) => (
    <div className="cz-grid3">
      {MEAL_KEYS.filter((k) => k !== heroKey).map((k) => {
        const meal = day[k];
        const plat = meal?.plat ? byId.get(meal.plat) : undefined;
        const filled = mealHasAny(meal);
        return (
          <button key={k} className={'cz-stile s-' + k + (filled ? ' filled' : '')} onClick={() => onOpenMeal(jourKey, k)}>
            {filled ? (
              plat && mealHasDraft(meal, k, byId) && <span className="sp vio"><IconStar size={12} /></span>
            ) : (
              <span className="sp">＋</span>
            )}
            <span className="se"><Em ch={filled && plat ? recipeEmoji(plat) : MOMENT_EMOJI[k]} size={22} /></span>
            <span className="sn">{filled ? (plat ? plat.nom : 'Sans plat') : MEAL_TILE[k]}</span>
          </button>
        );
      })}
    </div>
  );

  const inviteEmpty = (jourKey: string) => (
    <>
      <div className="cz-invite">
        <span className="disc"><Em ch="🍽️" size={32} /></span>
        <h3>Rien de prévu ce jour</h3>
        <p>Composez le menu, ou repartez d’une journée déjà faite.</p>
        <button className="cz-copybtn" onClick={openCopyPick}>
          <IconCopy size={15} /> Copier une journée
        </button>
        <div className="orr">— ou commencer un moment —</div>
      </div>
      <div className="cz-btiles">
        {MEAL_KEYS.map((k) => (
          <button key={k} className={'cz-btile s-' + k} onClick={() => onOpenMeal(jourKey, k)}>
            <span className="be"><Em ch={MOMENT_EMOJI[k]} size={22} /></span>
            <span className="bn">{MEAL_TILE[k]}</span>
            <span className="bp">＋</span>
          </button>
        ))}
      </div>
    </>
  );

  /** Corps de la vue jour : héros + tuiles, ou invitation si la journée est vide. */
  const dayBody = (i: number) => {
    const jour = SEED_CONFIG.jours[i];
    const day = week.days[jour.key];
    const isToday = weekOffset === 0 && i === todayIdx;
    const heroKey = pickHeroKey(day, isToday, heroNow);
    if (heroKey === null) return inviteEmpty(jour.key);
    return (
      <div className="cz-daybody">
        {heroCard(jour.key, day, heroKey)}
        <div className="cz-softlab">Le reste de la journée</div>
        {restTiles(jour.key, day, heroKey)}
      </div>
    );
  };

  // Contexte relatif d'un jour de la semaine AFFICHÉE (« aujourd'hui · », « demain · »).
  const relFor = (i: number) =>
    weekOffset === 0 && i === todayIdx
      ? 'aujourd’hui · '
      : (weekOffset === 0 && i === (todayIdx + 1) % 7 && todayIdx !== 6) ||
          (weekOffset === 1 && todayIdx === 6 && i === 0)
        ? 'demain · '
        : '';

  // Vue SEMAINE (refonte T2, maquette) : UNE carte par jour — repère de date,
  // résumé des plats, compteur de repas ; jour vide = « à composer ». La semaine
  // redevient une VUE D'ENSEMBLE : la carte MÈNE À LA JOURNÉE (`onSelectDay`),
  // où l'on compose (héros/tuiles → `onOpenMeal` → radial/composeur). Le geste
  // de composition n'est pas contourné — il vit dans la vue jour.
  const dayCard = (i: number) => {
    const jour = SEED_CONFIG.jours[i];
    const day = week.days[jour.key];
    const isToday = weekOffset === 0 && i === todayIdx;
    const filledKeys = MEAL_KEYS.filter((k) => mealHasAny(day[k]));
    const noms = filledKeys
      .map((k) => {
        const p = day[k]?.plat;
        return p ? byId.get(p)?.nom : undefined;
      })
      .filter(Boolean) as string[];
    const draft = filledKeys.some((k) => mealHasDraft(day[k], k, byId));
    const rl = relFor(i);
    // « Déjeuner, dîner » — le premier porte la majuscule (maquette).
    const moments = filledKeys.map((k, n) => (n === 0 && !rl ? MEAL_LABEL[k] : MEAL_LABEL[k].toLowerCase())).join(', ');
    // Un `aria-label` REMPLACE le nom calculé depuis le contenu : il doit donc
    // porter TOUT ce que la carte dit (résumé, compteur, à valider), sinon la
    // semaine devient muette pour les lecteurs d'écran — avant la refonte,
    // chaque repas était un bouton nommé par son plat.
    const aria = [
      `${jour.nom} ${dayLabel(dates[i])}`,
      isToday ? 'aujourd’hui' : '',
      filledKeys.length === 0
        ? 'rien de prévu, à composer'
        : `${filledKeys.length} repas : ${noms.length ? noms.join(', ') : 'repas sans plat'}`,
      draft ? 'une recette à valider' : '',
    ]
      .filter(Boolean)
      .join(' — ');
    return (
      <button
        key={jour.key}
        className={'cz-dcard' + (isToday ? ' today' : '') + (filledKeys.length === 0 ? ' void' : '')}
        onClick={() => onSelectDay(i)}
        aria-label={aria}
      >
        <span className="dl">
          <span className="dw2">{jour.nom.slice(0, 3)}</span>
          <span className="dn2">{dates[i].getDate()}</span>
        </span>
        <span className="di">
          <span className="ds">
            <span className="txt">
              {filledKeys.length === 0
                ? 'Rien de prévu — à composer'
                : noms.length === 0
                  ? 'Repas sans plat'
                  : noms.map((n, idx) => (
                      <span key={idx}>
                        {idx > 0 && <span className="sep"> · </span>}
                        {n}
                      </span>
                    ))}
            </span>
            {draft && (
              <span className="vio" title="à valider">
                <IconStar size={12} />
              </span>
            )}
          </span>
          {filledKeys.length > 0 && <span className="dsub">{rl}{moments}</span>}
        </span>
        <span className="dc">{filledKeys.length}</span>
      </button>
    );
  };

  // Datectx : contexte relatif + date pleine (proto : « **jeudi 16 juillet** »).
  const rel = relFor(dayIdx);

  // Refonte T1 : jour vide → l'invitation porte SON « Copier une journée » ; on
  // masque donc le « Copier … précédente » du bas (doublon). « Partager » reste,
  // lui (chemin d'accès). `dayFilled` = la journée AFFICHÉE a-t-elle un repas.
  const dayFilled = dayHasAny(week.days[SEED_CONFIG.jours[dayIdx].key]);

  const selector = (
    <div className="cz-selector">
      <button className={'cz-weekbtn' + (view === 'semaine' ? ' on' : '')} onClick={onToggleWeek} aria-pressed={view === 'semaine'}>
        <svg viewBox="0 0 16 16" aria-hidden>
          <rect x="1" y="1" width="6" height="6" rx="1.3" />
          <rect x="9" y="1" width="6" height="6" rx="1.3" />
          <rect x="1" y="9" width="6" height="6" rx="1.3" />
          <rect x="9" y="9" width="6" height="6" rx="1.3" />
        </svg>
        <span className="wl">{view === 'semaine' ? 'Semaine' : 'Semaine ›'}</span>
      </button>
      <div className="cz-sep" />
      <div className="cz-daystrip">
        {/* Proto : la bande commence À AUJOURD'HUI (on planifie vers l'avant) —
            les jours passés de la semaine courante n'y figurent pas. */}
        {SEED_CONFIG.jours
          .map((j, i) => ({ j, i }))
          .filter(({ i }) => weekOffset !== 0 || i >= todayIdx)
          .map(({ j, i }) => (
            <button
              key={j.key}
              className={'cz-day' + (view === 'jour' && i === dayIdx ? ' on' : '') + (view === 'semaine' ? ' dim' : '')}
              onClick={() => view === 'jour' && onSelectDay(i)}
              aria-pressed={view === 'jour' && i === dayIdx}
            >
              <span className="dl">{j.nom.slice(0, 3)}</span>
              <span className="dn">{dates[i].getDate()}</span>
              <span className="tdot">{weekOffset === 0 && i === todayIdx ? <i /> : null}</span>
            </button>
          ))}
      </div>
    </div>
  );

  return (
    <div>
      {/* F7.2 — le sélecteur vit DANS le contenu (jamais deux barres empilées).
          Défaut à l'ouverture : Demain (posé par CuisineView). */}
      {selector}

      {view === 'semaine' ? (
        <>
          <div className="cz-weeknav">
            <button className="cz-navchev" aria-label="Précédente" onClick={() => void navWeek(-1)}>
              <IconChevL size={16} />
            </button>
            {/* F1.3 : titre de vue = « menu de la semaine » (vocabulaire verrouillé) ; la date reste. */}
            <span className="cz-wk">
              Menu de la semaine
              <small>
                du {dayLabel(dates[0])} · {weekSub(weekOffset)}
              </small>
            </span>
            <button className="cz-navchev" aria-label="Suivante" onClick={() => void navWeek(1)}>
              <IconChevR size={16} />
            </button>
          </div>

          {weekEmpty && (
            <div className="cz-pad">
              <div className="cz-summary">
                <div className="cz-slab">Cette semaine</div>
                <div className="cz-sempty">Semaine vide — compose tes repas ou copie une semaine.</div>
              </div>
            </div>
          )}

          <button className="cz-subgen" onClick={onCopyWeek}>
            <IconCopy size={15} />
            Copier une semaine précédente
          </button>

          {toValidate > 0 && (
            <button className="cz-vbanner" onClick={onGoValidate}>
              <span className="cz-vi">
                <IconStar size={18} />
              </span>
              <span className="cz-vt">
                {toValidate} recette{toValidate > 1 ? 's' : ''} à valider dans cette semaine
              </span>
              <IconChevR size={16} />
            </button>
          )}

          <div className="cz-days">{SEED_CONFIG.jours.map((_, i) => dayCard(i))}</div>

          <button className="cz-shareprimary" onClick={onShare} aria-label="Partager le menu">
            <IconShareUp size={17} /> Partager la semaine
          </button>
          <div className="cz-sharehint">Envoyer la semaine à la personne de votre choix.</div>
        </>
      ) : (
        <>
          {/* DA v2 (refonte T1) : contexte de date sous le sélecteur, puis le corps
              de journée = carte héros + tuiles (jour plein) ou invitation (jour
              vide, qui porte son propre « Copier »). Sans « Générer ». */}
          <div className="cz-datectx">
            {rel}
            <b>
              {SEED_CONFIG.jours[dayIdx].nom.toLowerCase()} {dayLabel(dates[dayIdx])}
            </b>
          </div>
          {dayBody(dayIdx)}
          {dayFilled && (
            <button className="cz-ghost" onClick={openCopyPick}>
              <IconCopy size={15} />
              Copier une journée précédente
            </button>
          )}
          {copyPick && (
            <>
              <div className="cz-overlay show" onClick={() => setCopyPick(false)} />
              <div className="cz-sheet show" role="dialog" aria-modal="true">
                <div className="cz-handle" />
                <div className="cz-sheethead">
                  <div className="ttl">
                    Copier une journée
                    <small>vers {SEED_CONFIG.jours[dayIdx].nom.toLowerCase()} {dayLabel(dates[dayIdx])}</small>
                  </div>
                  <button className="cz-x" onClick={() => setCopyPick(false)} aria-label="Fermer">
                    ✕
                  </button>
                </div>
                <div className="cz-sheetbody">
                  <div style={{ paddingTop: 8 }}>
                    {copyCandidates.map((j) => (
                      <button key={j.key} className="cz-pick cz-copyday" onClick={() => copyFrom(j.key, j.nom)}>
                        <span className="nm" style={{ fontWeight: 700 }}>{j.nom}</span>
                        <span className="cz-copyresume">{dayResume(j.key)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Partager RESTE visible même sur un jour vide : c'est le chemin d'ACCÈS
              (Accès permanent / QR), utilisé avant même de composer — et le flux
              partage déconnecté en dépend (smoke Comptes). La maquette l'omet sur
              l'état vide (simplification de mock) → écart assumé, signalé au STOP. */}
          <button className="cz-shareprimary" onClick={onShare} aria-label="Partager le menu">
            <IconShareUp size={17} /> Partager la journée
          </button>
          <div className="cz-sharehint">Envoyer le menu à la personne de votre choix.</div>
        </>
      )}
    </div>
  );
}
