import { useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from '../lib/espace';
import type { SharedDay, SharedMeal } from '../lib/share';
import { scaledRows, splitSteps } from '../lib/ingredients';
import { DAY_AR } from '../lib/cuisineLabels';
import { todayKey, todayLabel } from './dates';
import SecuriteSection from '../components/SecuriteSection';
import { IconPlate, IconMic, IconChevL, IconChevR, IconBack, IconPlay, IconTranslate } from './icons';
import './cuisine.css';

// FC10 — Ce que la cuisinière voit : quoi cuisiner aujourd'hui et comment, dans
// sa langue, hors-ligne, sans app. PROJECTION « cuisine » : aucune macro / feu.
// La note vocale = voix de l'employeur (jamais synthétisée).

type Lang = 'fr' | 'ar';

const STR = {
  fr: {
    head: 'Cuisine',
    today: 'Aujourd’hui',
    dej: 'Déjeuner',
    din: 'Dîner',
    extra: 'En plus',
    voiceDot: 'Note vocale de Madame',
    ingLab: (n: number) => `Ingrédients · ${n} personne${n > 1 ? 's' : ''}`,
    stepLab: 'Préparation',
    voiceM: 'Écouter Madame',
    voiceS: 'Sa consigne vocale',
    noVoice: 'Pas de note vocale pour ce plat.',
    trans: 'Texte traduit automatiquement. La note vocale est la voix de Madame.',
    rest: 'Le reste de la semaine',
    offline: 'Hors-ligne',
    noSteps: 'Pas d’étapes — suis la note vocale.',
  },
  ar: {
    head: 'الكوزينة',
    today: 'اليوم',
    dej: 'الغدا',
    din: 'العشا',
    extra: 'زيادة',
    voiceDot: 'تسجيل صوتي ديال مدام',
    ingLab: (n: number) => `المقادير · ${n} ${n > 1 ? 'أشخاص' : 'شخص'}`,
    stepLab: 'الطريقة',
    voiceM: 'اسمع مدام',
    voiceS: 'التعليمات الصوتية',
    noVoice: 'ما كاينش تسجيل صوتي لهاد الطبق.',
    trans: 'الترجمة أوتوماتيكية. التسجيل الصوتي هو صوت مدام.',
    rest: 'باقي الأسبوع',
    offline: 'بلا أنترنت',
    noSteps: 'ما كايناش مراحل — تبع التسجيل الصوتي.',
  },
};

type Sel = { dayKey: string; slot: 'dej' | 'din' | 'ex'; exIdx?: number } | null;

export default function EspaceCuisine({ espace }: { espace: Espace }) {
  const [lang, setLang] = useState<Lang>(espace.langue);
  const [sel, setSel] = useState<Sel>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const ar = lang === 'ar';
  const t = STR[lang];
  const persons = espace.persons ?? 4;

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const days = espace.menu.days;
  const today = useMemo(() => {
    const k = todayKey();
    return days.find((d) => d.k === k) ?? days[0];
  }, [days]);

  const dayName = (d: SharedDay) => (ar ? DAY_AR[d.k] ?? d.nom : d.nom);
  const mealName = (m: SharedMeal) => (ar ? m.na || m.n : m.n);

  const selected = useMemo(() => {
    if (!sel) return null;
    const d = days.find((x) => x.k === sel.dayKey);
    if (!d) return null;
    const m = sel.slot === 'dej' ? d.dej : sel.slot === 'din' ? d.din : d.ex?.[sel.exIdx ?? 0];
    return m ? { day: d, meal: m } : null;
  }, [sel, days]);

  return (
    <div className="cz">
      <header className="ck-head">
        <div className="ck-left">
          {selected && (
            <button className="ck-backb" onClick={() => setSel(null)} aria-label="Retour">
              {ar ? <IconChevR size={18} /> : <IconBack size={18} />}
            </button>
          )}
          <div className={'ck-title' + (ar ? ' ar' : '')}>
            {selected ? mealName(selected.meal) : t.head}
          </div>
        </div>
        <div className="ck-right">
          {!online && <span className="ck-offline">● {t.offline}</span>}
          <div className="ck-langtog">
            <button aria-selected={!ar} onClick={() => setLang('fr')}>
              FR
            </button>
            <button className="ar" aria-selected={ar} onClick={() => setLang('ar')}>
              الدارجة
            </button>
          </div>
        </div>
      </header>

      <div className={'ck-body' + (ar ? ' rtl' : '')}>
        {selected ? (
          <RecipeView meal={selected.meal} lang={lang} persons={persons} />
        ) : (
          <Home
            days={days}
            today={today}
            lang={lang}
            onOpen={(dayKey, slot, exIdx) => setSel({ dayKey, slot, exIdx })}
            securite={espace.securite}
            dayName={dayName}
          />
        )}
      </div>
    </div>
  );
}

function MealCard({
  label,
  meal,
  lang,
  onClick,
}: {
  label: string;
  meal: SharedMeal;
  lang: Lang;
  onClick: () => void;
}) {
  const ar = lang === 'ar';
  const t = STR[lang];
  const name = ar ? meal.na || meal.n : meal.n;
  return (
    <button className="ck-mealcard" onClick={onClick}>
      <span className="ck-mi">
        <IconPlate size={22} />
      </span>
      <span className="ck-mc">
        <span className="ck-ml">{label}</span>
        <span className={'ck-mn' + (ar ? ' ar' : '')}>{name}</span>
        {meal.a && (
          <span className={'ck-vdot' + (ar ? ' ar' : '')}>
            <IconMic size={12} />
            {t.voiceDot}
          </span>
        )}
      </span>
      <span className="ck-chev">{ar ? <IconChevL size={18} /> : <IconChevR size={18} />}</span>
    </button>
  );
}

function Home({
  days,
  today,
  lang,
  onOpen,
  securite,
  dayName,
}: {
  days: SharedDay[];
  today: SharedDay | undefined;
  lang: Lang;
  onOpen: (dayKey: string, slot: 'dej' | 'din' | 'ex', exIdx?: number) => void;
  securite?: Espace['securite'];
  dayName: (d: SharedDay) => string;
}) {
  const ar = lang === 'ar';
  const t = STR[lang];
  const others = days.filter((d) => d !== today);

  return (
    <>
      {securite && securite.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SecuriteSection fiches={securite} lang={lang} />
        </div>
      )}

      {today ? (
        <>
          <div className={'ck-today' + (ar ? ' ar' : '')}>{t.today}</div>
          <div className={'ck-todaybig' + (ar ? ' ar' : '')}>{ar ? dayName(today) : todayLabel()}</div>
          {today.dej && <MealCard label={t.dej} meal={today.dej} lang={lang} onClick={() => onOpen(today.k, 'dej')} />}
          {today.din && <MealCard label={t.din} meal={today.din} lang={lang} onClick={() => onOpen(today.k, 'din')} />}
          {today.ex?.map((m, i) => (
            <MealCard key={i} label={t.extra} meal={m} lang={lang} onClick={() => onOpen(today.k, 'ex', i)} />
          ))}
        </>
      ) : (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '30px 0' }}>
          {ar ? 'ما كاين حتى منيو دابا.' : 'Aucun menu pour l’instant.'}
        </p>
      )}

      {others.length > 0 && (
        <>
          <div className={'ck-rest' + (ar ? ' ar' : '')}>{t.rest}</div>
          {others.map((d) => (
            <div key={d.k} className="ck-otherday">
              <div className={'ck-otherday-name' + (ar ? ' ar' : '')}>{dayName(d)}</div>
              {d.dej && <MealCard label={t.dej} meal={d.dej} lang={lang} onClick={() => onOpen(d.k, 'dej')} />}
              {d.din && <MealCard label={t.din} meal={d.din} lang={lang} onClick={() => onOpen(d.k, 'din')} />}
              {d.ex?.map((m, i) => (
                <MealCard key={i} label={t.extra} meal={m} lang={lang} onClick={() => onOpen(d.k, 'ex', i)} />
              ))}
            </div>
          ))}
        </>
      )}
    </>
  );
}

function RecipeView({ meal, lang, persons }: { meal: SharedMeal; lang: Lang; persons: number }) {
  const ar = lang === 'ar';
  const t = STR[lang];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const ingText = ar ? meal.ia || meal.i : meal.i;
  const rows = scaledRows(ingText, persons);
  const steps = splitSteps(ar ? meal.ea || meal.e : meal.e);
  const translationMissing = ar && (!meal.na || !meal.ia);

  const fixDuration = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    if (a.duration === Infinity || Number.isNaN(a.duration)) {
      const onUpdate = () => {
        a.removeEventListener('timeupdate', onUpdate);
        a.currentTime = 0;
      };
      a.addEventListener('timeupdate', onUpdate);
      a.currentTime = 1e7;
    }
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <div className={'ck-rn' + (ar ? ' ar' : '')}>{ar ? meal.na || meal.n : meal.n}</div>

      {meal.a ? (
        <>
          <button className="ck-voicehero" onClick={toggle}>
            <span className="ck-pl">
              <IconPlay size={20} />
            </span>
            <span className="ck-vt">
              <span className={'ck-vm' + (ar ? ' ar' : '')}>{t.voiceM}</span>
              <span className={'ck-vs' + (ar ? ' ar' : '')}>{playing ? '…' : t.voiceS}</span>
            </span>
            <span className="ck-wave">
              {Array.from({ length: 8 }).map((_, i) => (
                <i key={i} style={{ height: `${30 + ((i * 37) % 70)}%` }} />
              ))}
            </span>
          </button>
          <audio
            ref={audioRef}
            src={meal.a}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={fixDuration}
            preload="metadata"
            style={{ display: 'none' }}
          />
        </>
      ) : (
        <div className="ck-novoice">{t.noVoice}</div>
      )}

      <div className={'ck-rlab' + (ar ? ' ar' : '')}>{t.ingLab(persons)}</div>
      <ul className="ck-ingl">
        {rows.map((r, i) => (
          <li key={i}>
            <span className={'nm' + (ar ? ' ar' : '')}>{r.name}</span>
            {r.qty && <span className="q">{r.qty}</span>}
          </li>
        ))}
      </ul>

      <div className={'ck-rlab' + (ar ? ' ar' : '')}>{t.stepLab}</div>
      {steps.length > 0 ? (
        <ol className="ck-stepl">
          {steps.map((s, i) => (
            <li key={i} className={ar ? 'ar' : ''}>
              {s}
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>{t.noSteps}</p>
      )}

      <div className={'ck-transnote' + (ar ? ' ar' : '')}>
        <IconTranslate size={14} />
        {translationMissing
          ? ar
            ? 'الترجمة غير متوفرة — النص بالفرنسية. التسجيل الصوتي هو صوت مدام.'
            : 'Traduction non disponible — texte en français. La note vocale est la voix de Madame.'
          : t.trans}
      </div>
    </>
  );
}
