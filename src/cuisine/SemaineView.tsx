import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { assessDay, weekAverages, kcalStatusWord } from '../lib/nutrition';
import type { DayConfig, DayType, Recipe } from '../types';
import { weekDates, weekLabel, dayLabel } from './dates';
import GenerateWeekSheet from './GenerateWeekSheet';
import {
  IconChevL,
  IconChevR,
  IconSpark,
  IconStar,
  IconMic,
  IconPlus,
  IconLock,
  IconLockOpen,
  IconShuffle,
  IconSwap,
  IconGear,
} from './icons';

interface Props {
  voiceIds: Set<string>;
  onOpenPicker: (dayKey: string, slot: 'dej' | 'din') => void;
  onOpenRecipe: (id: string) => void;
  onGoValidate: () => void;
  toast: (msg: string) => void;
}

const NEXT_TYPE: Record<DayType, DayType> = { Repos: 'Cardio', Cardio: 'Muscu', Muscu: 'Repos' };

export default function SemaineView({
  voiceIds,
  onOpenPicker,
  onOpenRecipe,
  onGoValidate,
  toast,
}: Props) {
  const [genOpen, setGenOpen] = useState(false);
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const setDayType = useStore((s) => s.setDayType);
  const toggleLock = useStore((s) => s.toggleLock);
  const shuffleSlot = useStore((s) => s.shuffleSlot);

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const dates = useMemo(() => weekDates(), []);

  // Jours avec leur type effectif (override éventuel du ⚙ jour).
  const jours: DayConfig[] = useMemo(
    () =>
      SEED_CONFIG.jours.map((j) => ({
        ...j,
        type: week.days[j.key]?.type ?? j.type,
      })),
    [week.days],
  );

  const avg = useMemo(() => weekAverages(SEED_CONFIG, week.days, byId), [week.days, byId]);
  const avgCible = useMemo(
    () => Math.round(jours.reduce((s, j) => s + SEED_CONFIG.cibles.kcal_par_type[j.type], 0) / jours.length),
    [jours],
  );
  const avgStatus = kcalStatusWord(avg.perDay.kcal, avgCible, SEED_CONFIG.cibles);
  const avgPct = Math.min(100, Math.round((avg.perDay.kcal / (avgCible || 1)) * 100));

  // Bandeau « ✦ N à valider » : recettes du plan au statut Test (= à valider).
  const toValidate = useMemo(() => {
    const ids = new Set<string>();
    for (const j of SEED_CONFIG.jours) {
      const d = week.days[j.key];
      for (const id of [d?.dejId, d?.dinId]) {
        if (!id) continue;
        const r = byId.get(id);
        if (r && r.statut === 'Test') ids.add(id);
      }
    }
    return ids.size;
  }, [week.days, byId]);

  return (
    <div>
      <div className="cz-weeknav">
        <button
          className="cz-navchev"
          aria-label="Semaine précédente"
          onClick={() => toast('Une seule semaine pour l’instant')}
        >
          <IconChevL size={16} />
        </button>
        <span className="cz-wk">{weekLabel()}</span>
        <button
          className="cz-navchev"
          aria-label="Semaine suivante"
          onClick={() => toast('Une seule semaine pour l’instant')}
        >
          <IconChevR size={16} />
        </button>
      </div>

      <div className="cz-pad">
        <div className="cz-summary">
          <div className="cz-sumtop">
            <div>
              <div className="cz-slab">Moyenne de la semaine</div>
              <div className="cz-sval">
                {avg.perDay.kcal.toLocaleString('fr-FR')}
                <small>kcal / jour</small>
              </div>
            </div>
            <div className="cz-sprot">
              {avg.perDay.prot} g<small>protéines</small>
            </div>
          </div>
          <div className="cz-sgauge">
            <div
              className="cz-sgfill"
              style={{
                width: avgPct + '%',
                background:
                  avgStatus.cls === 'ok' ? '#7BD3A0' : avgStatus.cls === 'warn' ? '#F4B860' : '#F0897A',
              }}
            />
          </div>
        </div>
      </div>

      <button className="cz-genbtn" onClick={() => setGenOpen(true)}>
        <IconSpark size={18} />
        Générer la semaine
      </button>

      {genOpen && <GenerateWeekSheet onClose={() => setGenOpen(false)} toast={toast} />}

      {toValidate > 0 && (
        <button className="cz-vbanner" onClick={onGoValidate}>
          <span className="cz-vi">
            <IconStar size={20} />
          </span>
          <span className="cz-vt">
            {toValidate} recette{toValidate > 1 ? 's' : ''} générée{toValidate > 1 ? 's' : ''} à valider
            <small>Relis-les et ajoute-les à ta bibliothèque</small>
          </span>
          <IconChevR size={18} />
        </button>
      )}

      <div className="cz-days">
        {SEED_CONFIG.jours.map((jourBase, i) => {
          const jour = jours[i];
          const day = week.days[jour.key];
          const a = assessDay(jour, day, byId, SEED_CONFIG);
          const dej = day.dejId ? byId.get(day.dejId) : undefined;
          const din = day.dinId ? byId.get(day.dinId) : undefined;
          const complete = !!(day.dejId && day.dinId);
          const status = kcalStatusWord(a.totals.kcal, a.cibleKcal, SEED_CONFIG.cibles);
          const pct = Math.min(100, Math.round((a.totals.kcal / (a.cibleKcal || 1)) * 100));

          return (
            <div className="cz-daycard" key={jour.key}>
              <div className="cz-dayhead">
                <span className="cz-dayname">{jourBase.nom}</span>
                <span className="cz-daydate">{dayLabel(dates[i])}</span>
                <button
                  className="cz-dayedit"
                  onClick={() => {
                    const next = NEXT_TYPE[jour.type];
                    setDayType(jour.key, next);
                    toast(`Jour ${next} · cible ${SEED_CONFIG.cibles.kcal_par_type[next]} kcal`);
                  }}
                >
                  <IconGear size={13} />
                  {jour.type}
                </button>
              </div>

              <SlotRow
                label="Déj"
                recipe={dej}
                locked={!!day.lockDej}
                hasVoice={dej ? voiceIds.has(dej.id) : false}
                onOpen={() => (dej ? onOpenRecipe(dej.id) : onOpenPicker(jour.key, 'dej'))}
                onChoose={() => onOpenPicker(jour.key, 'dej')}
                onLock={() => toggleLock(jour.key, 'dej')}
                onShuffle={() => {
                  const ok = shuffleSlot(jour.key, 'dej');
                  if (!ok) toast(day.lockDej ? 'Repas verrouillé' : 'Aucune autre recette validée');
                }}
              />
              <SlotRow
                label="Dîn"
                recipe={din}
                locked={!!day.lockDin}
                hasVoice={din ? voiceIds.has(din.id) : false}
                onOpen={() => (din ? onOpenRecipe(din.id) : onOpenPicker(jour.key, 'din'))}
                onChoose={() => onOpenPicker(jour.key, 'din')}
                onLock={() => toggleLock(jour.key, 'din')}
                onShuffle={() => {
                  const ok = shuffleSlot(jour.key, 'din');
                  if (!ok) toast(day.lockDin ? 'Repas verrouillé' : 'Aucune autre recette validée');
                }}
              />

              <div className="cz-socle">
                <IconStar size={14} />
                <span>
                  <b>Socle auto</b> · collation + kéfir du coucher
                </span>
              </div>

              {complete ? (
                <div className="cz-gauge">
                  <div className="cz-gtrack">
                    <div className={'cz-gfill ' + status.cls} style={{ width: pct + '%' }} />
                    <div className="cz-gtick" style={{ left: '100%' }} />
                  </div>
                  <div className="cz-gmeta">
                    <span className="cz-gk">{a.totals.kcal.toLocaleString('fr-FR')} kcal</span>
                    <span className={'cz-gstatus ' + status.cls}>{status.word}</span>
                  </div>
                </div>
              ) : (
                <div className="cz-gincomplete">
                  Complète le déjeuner et le dîner pour voir l’équilibre.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotRow({
  label,
  recipe,
  locked,
  hasVoice,
  onOpen,
  onChoose,
  onLock,
  onShuffle,
}: {
  label: string;
  recipe: Recipe | undefined;
  locked: boolean;
  hasVoice: boolean;
  onOpen: () => void;
  onChoose: () => void;
  onLock: () => void;
  onShuffle: () => void;
}) {
  if (!recipe) {
    return (
      <button className="cz-slot empty" onClick={onOpen}>
        <span className="cz-meal">{label}</span>
        <span className="cz-name">
          <IconPlus size={16} /> Ajouter une recette
        </span>
      </button>
    );
  }
  return (
    <div className="cz-slot" onClick={onOpen} role="button" tabIndex={0}>
      <span className="cz-meal">{label}</span>
      <span className="cz-name">
        {recipe.nom}
        {recipe.statut === 'Test' && (
          <span className="cz-mk ai" title="À valider">
            <IconStar size={13} />
          </span>
        )}
        {hasVoice && (
          <span className="cz-mk v" title="Note vocale">
            <IconMic size={13} />
          </span>
        )}
      </span>
      <span className="cz-kcal">{recipe.kcal}</span>
      <span className="cz-slotact">
        <button
          className="cz-miniact"
          title="Changer ce repas"
          onClick={(e) => {
            e.stopPropagation();
            onChoose();
          }}
        >
          <IconSwap size={15} />
        </button>
        <button
          className={'cz-miniact' + (locked ? ' locked' : '')}
          title="Verrouiller"
          onClick={(e) => {
            e.stopPropagation();
            onLock();
          }}
        >
          {locked ? <IconLock size={15} /> : <IconLockOpen size={15} />}
        </button>
        <button
          className="cz-miniact"
          title="Remplacer"
          onClick={(e) => {
            e.stopPropagation();
            onShuffle();
          }}
        >
          <IconShuffle size={15} />
        </button>
      </span>
    </div>
  );
}
