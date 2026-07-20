import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { dayHasAny, mealHasAny, mealHasDraft } from '../lib/menu';
import type { MealKey } from '../types';
import { weekDatesOffset, weekSub, dayLabel } from './dates';
import { IconChevL, IconChevR, IconStar, IconCopy, IconShareUp } from './icons';
import { recipeEmoji } from '../lib/emoji';
import Em from '../ui/Em';

// T3 (lot UI) : 4 moments, libellés alignés Menu ↔ page reçue (SPEC 3 —
// les clés du modèle, du digest et de la projection ne bougent pas).
const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Petit déjeuner', dej: 'Déjeuner', gouter: 'Goûter', diner: 'Dîner' };
/** Libellés courts de la vue semaine (proto : P.déj / Déj / Goût / Dîner). */
const MEAL_SHORT: Record<MealKey, string> = { petitdej: 'P.déj', dej: 'Déj', gouter: 'Goût', diner: 'Dîner' };
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

  // Vue JOUR (proto) : une CARTE PAR MOMENT — chip tinté + label coloré +
  // plat (emoji déterministe) ou « Ajouter un repas ». `day[k]` peut être
  // absent (jour pré-T3) → traité comme vide.
  const momentCards = (i: number) => {
    const jour = SEED_CONFIG.jours[i];
    const day = week.days[jour.key];
    return MEAL_KEYS.map((k) => {
      const meal = day[k];
      const plat = meal?.plat ? byId.get(meal.plat) : undefined;
      const filled = mealHasAny(meal);
      const sub: string[] = [];
      if (meal && (k === 'dej' || k === 'diner')) {
        if (meal.entree) {
          const e = byId.get(meal.entree);
          if (e) sub.push('Entrée : ' + e.nom);
        }
        if (meal.acc) {
          const a = byId.get(meal.acc.id);
          if (a) sub.push(`${a.nom} ${meal.acc.g} g`);
        }
      }
      return (
        <button key={k} className={'cz-mrow cz-mo s-' + k + (filled ? '' : ' empty')} onClick={() => onOpenMeal(jour.key, k)}>
          <span className="mchip">{plat ? <Em ch={recipeEmoji(plat)} size={28} /> : <span className="plus">＋</span>}</span>
          <span className="mid">
            <span className="mlabel">{MEAL_LABEL[k]}</span>
            <span className="mn">
              {plat ? plat.nom : filled ? 'Sans plat' : 'Ajouter un repas'}
              {plat && mealHasDraft(meal, k, byId) && (
                <span className="vio" title="à valider">
                  <IconStar size={13} />
                </span>
              )}
            </span>
            {sub.length > 0 && <span className="sub">{sub.join(' · ')}</span>}
          </span>
          <span className="chev">
            <IconChevR size={16} />
          </span>
        </button>
      );
    });
  };

  // Vue SEMAINE (SPEC 4, proto) : carte compacte par jour, une ligne par moment.
  const dayCard = (i: number) => {
    const jour = SEED_CONFIG.jours[i];
    const day = week.days[jour.key];
    const isToday = weekOffset === 0 && i === todayIdx;
    return (
      <div className="cz-daycard" key={jour.key}>
        <div className="cz-wdh">
          <span className="cz-dayname">
            {jour.nom}
            {isToday && <span className="wtag"> · auj.</span>}
          </span>
          <span className="cz-daydate">{dayLabel(dates[i])}</span>
        </div>

        {MEAL_KEYS.map((k) => {
          const meal = day[k];
          const plat = meal?.plat ? byId.get(meal.plat) : undefined;
          const filled = mealHasAny(meal);
          return (
            <button
              key={k}
              className={'cz-mrow cz-wln' + (filled ? '' : ' empty')}
              onClick={() => onOpenMeal(jour.key, k)}
            >
              <span className={'wk s-' + k}>{MEAL_SHORT[k]}</span>
              <span className="wv">
                {plat ? plat.nom : filled ? 'Sans plat' : '＋ Ajouter'}
                {plat && mealHasDraft(meal, k, byId) && (
                  <span className="vio" title="à valider">
                    <IconStar size={12} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // Datectx : contexte relatif + date pleine (proto : « **jeudi 16 juillet** »).
  const rel =
    weekOffset === 0 && dayIdx === todayIdx
      ? 'aujourd’hui · '
      : (weekOffset === 0 && dayIdx === (todayIdx + 1) % 7 && todayIdx !== 6) ||
          (weekOffset === 1 && todayIdx === 6 && dayIdx === 0)
        ? 'demain · '
        : '';

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
          {/* DA v2 (T2, proto) : contexte de date sous le sélecteur ; état vide =
              composer (les rangées « Ajouter » de la carte) + Copier — sans « Générer ». */}
          <div className="cz-datectx">
            {rel}
            <b>
              {SEED_CONFIG.jours[dayIdx].nom.toLowerCase()} {dayLabel(dates[dayIdx])}
            </b>
          </div>
          <div className="cz-meals">{momentCards(dayIdx)}</div>
          <button className="cz-ghost" onClick={openCopyPick}>
            <IconCopy size={15} />
            Copier une journée précédente
          </button>
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
          <button className="cz-shareprimary" onClick={onShare} aria-label="Partager le menu">
            <IconShareUp size={17} /> Partager la journée
          </button>
          <div className="cz-sharehint">Envoyer le menu à la personne de votre choix.</div>
        </>
      )}
    </div>
  );
}
