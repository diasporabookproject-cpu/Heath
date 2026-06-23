import { useState } from 'react';
import { DAY_AR, LABELS, TYPE_AR, type Lang } from '../lib/cuisineLabels';
import type { SharedDay, SharedMeal, SharedMenu } from '../lib/share';

// Page en lecture seule ouverte par la cuisinière via le lien partagé.
// Affiche le menu (FR / darija) ; les notes vocales sont en placeholder
// (l'audio arrivera avec le backend).

export default function SharedMenuView({
  menu,
  initialLang = 'fr',
}: {
  menu: SharedMenu;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const ar = lang === 'ar';
  const L = LABELS[lang];

  const name = (m: SharedMeal) => (ar ? m.na || m.n : m.n);
  const ing = (m: SharedMeal) => (ar ? m.ia || m.i : m.i);

  // Repli : certains fichiers WebM (anciens) n'ont pas de durée → on force le
  // navigateur à la calculer, sinon la lecture se coupe au bout d'1-2 s.
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

  const Meal = ({ labelKey, m }: { labelKey: keyof typeof L; m: SharedMeal }) => (
    <div className="cook-meal" dir={ar ? 'rtl' : 'ltr'}>
      <div className="cook-meal__label">{L[labelKey]}</div>
      <div className="cook-meal__name">{name(m)}</div>
      <div className="cook-meal__ing">{ing(m)}</div>
      {ar && !m.ia && <div className="cook-meal__note">⚠︎ الترجمة غير متوفرة — النص بالفرنسية</div>}
      {m.a ? (
        <div className="voice-note__row" style={{ marginTop: 8 }}>
          <span className="voice-note__title">🔊 {ar ? 'ملاحظة صوتية' : 'Note vocale'}</span>
          <audio src={m.a} controls className="voice-note__audio" onLoadedMetadata={fixDuration} preload="metadata" />
        </div>
      ) : (
        m.v && (
          <div className="voice-placeholder">
            🔊 {ar ? 'ملاحظة صوتية — قريباً' : 'Note vocale — bientôt'}
          </div>
        )
      )}
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">{ar ? 'منيو الأسبوع' : 'Menu de la semaine'}</header>
      <main className="app__main">
        <div className="lang-switch" role="group" aria-label="Langue">
          <button
            className={'lang-btn' + (lang === 'fr' ? ' lang-btn--active' : '')}
            onClick={() => setLang('fr')}
          >
            Français
          </button>
          <button
            className={'lang-btn' + (lang === 'ar' ? ' lang-btn--active' : '')}
            onClick={() => setLang('ar')}
          >
            الدارجة
          </button>
        </div>

        <p className="hint">
          {ar
            ? 'المقادير لكل حصة وحدة. ملاعق القياس (صغيرة/كبيرة) مقصودة.'
            : 'Ingrédients pesés (1 portion). Les mesures à la cuillère (càc/càs) sont volontaires.'}
        </p>

        {menu.days.length === 0 && <p className="empty-note">Menu vide.</p>}

        {menu.days.map((d: SharedDay) => (
          <div className="card" key={d.k}>
            <div className="cook-day__title" dir={ar ? 'rtl' : 'ltr'}>
              {ar ? DAY_AR[d.k] ?? d.nom : d.nom}{' '}
              <span className="daycard__type">· {ar ? TYPE_AR[d.t] ?? d.t : d.t}</span>
            </div>
            {d.dej && <Meal labelKey="dej" m={d.dej} />}
            {d.din && <Meal labelKey="din" m={d.din} />}
            {d.ex?.map((m, i) => <Meal key={i} labelKey="extra" m={m} />)}
          </div>
        ))}

        <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>
          {ar ? 'مُرسَل من تطبيق منيو الأسبوع' : 'Envoyé depuis l’app Menu de la semaine'}
        </p>
      </main>
    </div>
  );
}
