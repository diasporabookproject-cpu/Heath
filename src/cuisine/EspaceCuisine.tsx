import { useEffect, useMemo, useRef, useState } from 'react';
import type { Espace } from '../lib/espace';
import type { SharedComp, SharedDay, SharedMealV2 } from '../lib/share';
import {
  flushPending,
  loadCachedEvents,
  loadPending,
  mealItemKey,
  mergePending,
  queuePending,
  readChecks,
  reduceChecks,
  saveCachedEvents,
  sendCheck,
  taskItemKey,
  type CheckEvent,
  type CheckState,
} from '../lib/espace-checks';
import { scaledRows, splitSteps } from '../lib/ingredients';
import { DAY_AR } from '../lib/cuisineLabels';
import { todayKey, todayLabel } from './dates';
import SecuriteSection from '../components/SecuriteSection';
import { IconPlate, IconMic, IconChevL, IconChevR, IconBack, IconPlay, IconTranslate } from './icons';
import './cuisine.css';

type Lang = 'fr' | 'ar';
type MK = 'petitdej' | 'dej' | 'gouter' | 'diner';
// T3 (lot UI) : `gouter` AJOUTÉ — les pages publiées avant n'ont pas la clé ;
// le rendu filtre sur la présence (`d[k]`), donc un lien ancien rend à
// l'identique (lien perpétuel — test explicite espace-gouter.test).
const MK_LIST: MK[] = ['petitdej', 'dej', 'gouter', 'diner'];

const STR = {
  fr: {
    head: 'Cuisine', today: 'Aujourd’hui',
    petitdej: 'Petit-déjeuner', dej: 'Déjeuner', gouter: 'Goûter', diner: 'Dîner',
    plat: 'Plat', entree: 'Entrée', acc: 'Accompagnement',
    voiceDot: 'Note vocale de Madame', voiceM: 'Écouter Madame', voiceS: 'Sa consigne vocale',
    noVoice: 'Pas de note vocale.', ing: 'Ingrédients', steps: 'Préparation',
    noSteps: 'Pas d’étapes — suis la note vocale.', rest: 'Le reste de la semaine', offline: 'Hors-ligne',
    trans: 'Texte traduit automatiquement. La note vocale est la voix de Madame.',
    tasks: 'Tâches en plus', check: 'Fait', tosync: 'Coché — se transmettra avec le réseau',
  },
  ar: {
    head: 'الكوزينة', today: 'اليوم',
    petitdej: 'الفطور', dej: 'الغدا', gouter: 'اللمجة', diner: 'العشا',
    plat: 'الطبق', entree: 'مقبّلات', acc: 'إضافة',
    voiceDot: 'تسجيل ديال مدام', voiceM: 'اسمع مدام', voiceS: 'التعليمات الصوتية',
    noVoice: 'ما كاينش تسجيل صوتي.', ing: 'المقادير', steps: 'الطريقة',
    noSteps: 'ما كايناش مراحل — تبع التسجيل.', rest: 'باقي الأسبوع', offline: 'بلا أنترنت',
    trans: 'الترجمة أوتوماتيكية. التسجيل الصوتي هو صوت مدام.',
    tasks: 'مهام زايدة', check: 'تدارت', tosync: 'تسجّلات — غادي توصل ملي يرجع الإنترنت',
  },
};

/** `token` absent = APERÇU côté employeur : cases visibles, non interactives. */
export default function EspaceCuisine({ espace, token }: { espace: Espace; token?: string }) {
  const [lang, setLang] = useState<Lang>(espace.langue);
  const [sel, setSel] = useState<{ dayKey: string; meal: MK } | null>(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  // T3 (lot partage) — l'état des coches : serveur (ou cache) ⊕ file locale.
  const [checks, setChecks] = useState<Map<string, CheckState>>(new Map());
  const checklist = espace.cl === 1;
  const ar = lang === 'ar';
  const t = STR[lang];
  const persons = espace.persons ?? 4;
  const days = espace.menu.days;

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

  // Coches : rejouer la file, lire le journal (ou le cache si injoignable),
  // fusionner avec les gestes locaux en attente. Re-tenté au retour du réseau.
  useEffect(() => {
    if (!token || !checklist) return;
    let alive = true;
    const sync = async () => {
      await flushPending(token);
      const server = await readChecks(token);
      if (server) saveCachedEvents(token, server);
      const base = server ?? loadCachedEvents(token);
      if (alive) setChecks(mergePending(reduceChecks(base), loadPending(token)));
    };
    void sync();
    window.addEventListener('online', sync);
    return () => {
      alive = false;
      window.removeEventListener('online', sync);
    };
  }, [token, checklist]);

  /** Le geste : optimiste à l'écran, transmis best-effort, sinon en file. */
  const toggleCheck = (item: string) => {
    if (!token) return; // aperçu employeur : inerte
    const next = !checks.get(item)?.done;
    const ev: CheckEvent = { item, done: next, at: new Date().toISOString() };
    setChecks((prev) => mergePending(prev, [ev]));
    void sendCheck(token, ev).then((res) => {
      if (res === 'ok') saveCachedEvents(token, [...loadCachedEvents(token), ev]);
      else if (res === 'offline') queuePending(token, ev);
      // 'rejected' (lien coupé) : rien — la page basculera « retirée » au prochain chargement.
    });
  };

  const today = useMemo(() => {
    const k = todayKey();
    return days.find((d) => d.k === k) ?? days[0];
  }, [days]);

  const dayName = (d: SharedDay) => (ar ? DAY_AR[d.k] ?? d.nom : d.nom);
  const compName = (c: SharedComp) => (ar ? c.na || c.n : c.n);
  const selected = sel ? days.find((d) => d.k === sel.dayKey) : undefined;
  const selectedMeal = selected && sel ? (selected[sel.meal] as SharedMealV2 | undefined) : undefined;
  const headerTitle = selectedMeal ? (ar ? t[sel!.meal] : t[sel!.meal]) : t.head;

  return (
    <div className="cz">
      <header className="ck-head">
        <div className="ck-left">
          {selectedMeal && (
            <button className="ck-backb" onClick={() => setSel(null)} aria-label="Retour">
              {ar ? <IconChevR size={18} /> : <IconBack size={18} />}
            </button>
          )}
          <div className={'ck-title' + (ar ? ' ar' : '')}>{headerTitle}</div>
        </div>
        <div className="ck-right">
          {!online && <span className="ck-offline">● {t.offline}</span>}
          <div className="ck-langtog">
            <button aria-selected={!ar} onClick={() => setLang('fr')}>FR</button>
            <button className="ar" aria-selected={ar} onClick={() => setLang('ar')}>الدارجة</button>
          </div>
        </div>
      </header>

      <div className={'ck-body' + (ar ? ' rtl' : '')}>
        {selectedMeal && sel ? (
          <MealView meal={selectedMeal} lang={lang} persons={persons} />
        ) : (
          <Home
            days={days}
            today={today}
            lang={lang}
            onOpen={(dayKey, meal) => setSel({ dayKey, meal })}
            securite={espace.securite}
            dayName={dayName}
            compName={compName}
            checklist={checklist}
            tasks={espace.tasks}
            checks={checks}
            onToggle={token ? toggleCheck : undefined}
          />
        )}
      </div>
    </div>
  );
}

function mealHasVoice(m: SharedMealV2): boolean {
  return !!(m.plat?.a || m.entree?.a || m.acc?.a);
}

function MealCard({
  label,
  meal,
  lang,
  compName,
  onClick,
  check,
}: {
  label: string;
  meal: SharedMealV2;
  lang: Lang;
  compName: (c: SharedComp) => string;
  onClick: () => void;
  /** T3 : case « fait » (repas d'aujourd'hui, checklist active). `on` = état ;
   *  `onToggle` absent = aperçu (case visible, inerte). */
  check?: { on: boolean; onToggle?: () => void };
}) {
  const ar = lang === 'ar';
  const t = STR[lang];
  const title = meal.plat ? compName(meal.plat) : meal.entree ? compName(meal.entree) : '—';
  // Sous-ligne pour un repas structuré (entrée / accompagnement).
  const extras: string[] = [];
  if (meal.entree) extras.push(`${t.entree} : ${compName(meal.entree)}`);
  if (meal.acc) extras.push(`${compName(meal.acc)}${meal.acc.g ? ` ${meal.acc.g} g` : ''}`);
  // F5.5 — allergènes du foyer touchés par ce repas (dès l'accueil, G3).
  const warns = [...new Set([meal.plat, meal.entree, meal.acc].flatMap((c) => c?.w ?? []))];
  return (
    <button className="ck-mealcard" onClick={onClick}>
      <span className="ck-mi">
        <IconPlate size={22} />
      </span>
      <span className="ck-mc">
        <span className="ck-ml">{label}</span>
        <span className={'ck-mn' + (ar ? ' ar' : '')}>{title}</span>
        {extras.length > 0 && (
          <span className={'ck-msub' + (ar ? ' ar' : '')}>{extras.join(' · ')}</span>
        )}
        {warns.length > 0 && (
          <span className={'ck-warn' + (ar ? ' ar' : '')}>
            ⚠ {ar ? 'انتبهي — فيها : ' : 'Attention — contient : '}
            {warns.join(' · ')}
          </span>
        )}
        {mealHasVoice(meal) && (
          <span className={'ck-vdot' + (ar ? ' ar' : '')}>
            <IconMic size={12} />
            {t.voiceDot}
          </span>
        )}
      </span>
      {check && (
        <span
          className={'ck-check' + (check.on ? ' on' : '') + (check.onToggle ? '' : ' ro')}
          role="checkbox"
          aria-checked={check.on}
          aria-label={t.check}
          tabIndex={check.onToggle ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            check.onToggle?.();
          }}
        >
          {check.on ? '✓' : ''}
        </span>
      )}
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
  compName,
  checklist,
  tasks,
  checks,
  onToggle,
}: {
  days: SharedDay[];
  today: SharedDay | undefined;
  lang: Lang;
  onOpen: (dayKey: string, meal: MK) => void;
  securite?: Espace['securite'];
  dayName: (d: SharedDay) => string;
  compName: (c: SharedComp) => string;
  /** T3 — suivi des tâches (absent sur une page publiée avant : rendu inchangé). */
  checklist?: boolean;
  tasks?: Espace['tasks'];
  checks?: Map<string, CheckState>;
  onToggle?: (item: string) => void;
}) {
  const ar = lang === 'ar';
  const t = STR[lang];
  const others = days.filter((d) => d !== today);

  // T3 : la case vit sur les repas d'AUJOURD'HUI (le geste quotidien) — la clé
  // porte l'empreinte du NOM FR (`n`, stable quelle que soit la langue lue).
  const cards = (d: SharedDay) =>
    MK_LIST.filter((k) => d[k]).map((k) => {
      const meal = d[k] as SharedMealV2;
      const comp = meal.plat ?? meal.entree;
      const withCheck = checklist && d === today && comp;
      const item = withCheck ? mealItemKey(d.k, k, comp.n) : null;
      return (
        <MealCard
          key={k}
          label={t[k]}
          meal={meal}
          lang={lang}
          compName={compName}
          onClick={() => onOpen(d.k, k)}
          check={
            item
              ? { on: !!checks?.get(item)?.done, onToggle: onToggle ? () => onToggle(item) : undefined }
              : undefined
          }
        />
      );
    });

  // Tâches libres (texte de l'employeur — fr SEUL, décision ③ : visible tel
  // quel côté darija, jamais masqué — même contrat qu'espace-legere).
  const taskRows =
    checklist && tasks && tasks.length > 0 ? (
      <>
        <div className={'ck-today ck-tasklab' + (ar ? ' ar' : '')}>{t.tasks}</div>
        {tasks.map((task) => {
          const item = taskItemKey(task.id);
          const on = !!checks?.get(item)?.done;
          return (
            <button
              key={task.id}
              className={'ck-taskrow' + (on ? ' on' : '')}
              onClick={onToggle ? () => onToggle(item) : undefined}
              disabled={!onToggle}
            >
              <span className={'ck-check' + (on ? ' on' : '') + (onToggle ? '' : ' ro')} aria-hidden>
                {on ? '✓' : ''}
              </span>
              <span className="tx" dir="ltr">
                {task.t}
              </span>
            </button>
          );
        })}
      </>
    ) : null;

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
          {cards(today)}
          {taskRows}
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
              {cards(d)}
            </div>
          ))}
        </>
      )}
    </>
  );
}

function MealView({ meal, lang, persons }: { meal: SharedMealV2; lang: Lang; persons: number }) {
  const t = STR[lang];
  const parts: { role: 'plat' | 'entree' | 'acc'; comp: SharedComp }[] = [];
  if (meal.entree) parts.push({ role: 'entree', comp: meal.entree });
  if (meal.plat) parts.push({ role: 'plat', comp: meal.plat });
  if (meal.acc) parts.push({ role: 'acc', comp: meal.acc });
  return (
    <>
      {parts.map((p, i) => (
        <CompBlock key={i} role={p.role} comp={p.comp} lang={lang} persons={persons} showRole={parts.length > 1} />
      ))}
      <div className={'ck-transnote' + (lang === 'ar' ? ' ar' : '')}>
        <IconTranslate size={14} />
        {t.trans}
      </div>
    </>
  );
}

function CompBlock({
  role,
  comp,
  lang,
  persons,
  showRole,
}: {
  role: 'plat' | 'entree' | 'acc';
  comp: SharedComp;
  lang: Lang;
  persons: number;
  showRole: boolean;
}) {
  const ar = lang === 'ar';
  const t = STR[lang];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const name = ar ? comp.na || comp.n : comp.n;
  const rows =
    role === 'acc'
      ? [{ name, qty: `${Math.round((comp.g ?? 100) * persons)} g` }]
      : scaledRows(ar ? comp.ia || comp.i : comp.i, persons);
  const steps = role === 'acc' ? [] : splitSteps(ar ? comp.ea || comp.e : comp.e);

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
    <div style={{ marginBottom: 22 }}>
      {showRole && <div className={'ck-rlab' + (ar ? ' ar' : '')}>{t[role]}</div>}
      <div className={'ck-rn' + (ar ? ' ar' : '')} style={{ fontSize: 20, marginBottom: 12 }}>
        {name}
      </div>

      {/* F5.5 — alerte allergène du FOYER (règles T3), calculée à la publication,
          MISE EN ÉVIDENCE sur la recette (G3 : jamais silencieuse). Phrase fixe
          bilingue (registre du gate) ; le terme reste tel que posé par l'employeur. */}
      {comp.w && comp.w.length > 0 && (
        <div className={'ck-warnbox' + (ar ? ' ar' : '')}>
          ⚠ {ar ? 'انتبهي — قاعدة الدار : فيها ' : 'Attention — règle du foyer : contient '}
          <b>{comp.w.join(' · ')}</b>
        </div>
      )}

      {comp.a && (
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
            src={comp.a}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={fixDuration}
            preload="metadata"
            style={{ display: 'none' }}
          />
        </>
      )}

      {/* T4 (recette légère) : nom seul → la section Ingrédients est OMISE
          proprement (pas d'en-tête orphelin), comme les étapes absentes. */}
      {rows.length > 0 && (
        <>
          <div className={'ck-rlab' + (ar ? ' ar' : '')}>{t.ing}</div>
          <ul className="ck-ingl">
            {rows.map((r, i) => (
              <li key={i}>
                <span className={'nm' + (ar ? ' ar' : '')}>{r.name}</span>
                {r.qty && <span className="q">{r.qty}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {role !== 'acc' && (
        <>
          <div className={'ck-rlab' + (ar ? ' ar' : '')}>{t.steps}</div>
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
        </>
      )}
    </div>
  );
}
