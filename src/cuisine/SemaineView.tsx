import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { dayHasAny, mealHasDraft } from '../lib/menu';
import type { DayMenu, MealKey, Recipe } from '../types';
import { weekDatesOffset, weekSub, dayLabel } from './dates';
import { IconChevL, IconChevR, IconStar, IconPlus, IconCopy, IconShareUp } from './icons';

// F7.2 : repas = Matin / Midi / Soir (libellés seuls — les clés du modèle,
// du digest et de la projection ne bougent pas : compat totale).
const MEAL_LABEL: Record<MealKey, string> = { petitdej: 'Matin', dej: 'Midi', diner: 'Soir' };
const MEAL_KEYS: MealKey[] = ['petitdej', 'dej', 'diner'];

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

  // F7.2 (amendement ① + Q4) : « Copier la journée précédente » = le DERNIER jour
  // non vide avant le jour affiché (dans la semaine affichée) ; cible non vide →
  // confirmation explicite, jamais d'écrasement silencieux.
  const copyDay = () => {
    const targetKey = SEED_CONFIG.jours[dayIdx].key;
    let src: { key: string; nom: string; day: DayMenu } | null = null;
    for (let i = dayIdx - 1; i >= 0; i--) {
      const j = SEED_CONFIG.jours[i];
      if (dayHasAny(week.days[j.key])) {
        src = { key: j.key, nom: j.nom, day: week.days[j.key] };
        break;
      }
    }
    if (!src) {
      toast('Rien à copier pour l’instant — compose ton premier repas');
      return;
    }
    if (dayHasAny(week.days[targetKey]) && !window.confirm('Ce jour a déjà des repas — les remplacer ?')) {
      return;
    }
    copyDayInto(targetKey, src.day);
    toast(`Journée copiée depuis ${src.nom}`);
  };

  const dayCard = (i: number) => {
    const jour = SEED_CONFIG.jours[i];
    const day = week.days[jour.key];
    return (
      <div className="cz-daycard" key={jour.key}>
        <div className="cz-dayhead">
          <span className="cz-dayname">{jour.nom}</span>
          <span className="cz-daydate">{dayLabel(dates[i])}</span>
        </div>

        {MEAL_KEYS.map((k) => (
          <MealRow
            key={k}
            label={MEAL_LABEL[k]}
            meal={day[k]}
            mealKey={k}
            byId={byId}
            onClick={() => onOpenMeal(jour.key, k)}
          />
        ))}
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
          <div className="cz-days">{dayCard(dayIdx)}</div>
          <button className="cz-ghost" onClick={copyDay}>
            <IconCopy size={15} />
            Copier la journée précédente
          </button>
          <button className="cz-shareprimary" onClick={onShare} aria-label="Partager le menu">
            <IconShareUp size={17} /> Partager la journée
          </button>
          <div className="cz-sharehint">Envoyer le menu à la personne de votre choix.</div>
        </>
      )}
    </div>
  );
}

function MealRow({
  label,
  meal,
  mealKey,
  byId,
  onClick,
}: {
  label: string;
  meal: import('../types').MealSlot;
  mealKey: MealKey;
  byId: Map<string, Recipe>;
  onClick: () => void;
}) {
  const plat = meal.plat ? byId.get(meal.plat) : undefined;
  if (!plat) {
    return (
      <button className="cz-mrow empty" onClick={onClick}>
        <span className="ml">{label}</span>
        <span className="mid">
          <span className="mn">
            <IconPlus size={15} /> Ajouter
          </span>
        </span>
        <span className="chev">
          <IconChevR size={16} />
        </span>
      </button>
    );
  }
  const sub: string[] = [];
  if (mealKey !== 'petitdej') {
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
    <button className="cz-mrow" onClick={onClick}>
      <span className="ml">{label}</span>
      <span className="mid">
        <span className="mn">
          {plat.nom}
          {mealHasDraft(meal, mealKey, byId) && (
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
}
