import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import type { DayConfig, DayMenu, Recipe } from '../types';
import VoiceNote from '../components/VoiceNote';
import { DAY_AR, LABELS, TYPE_AR, type Lang } from '../lib/cuisineLabels';
import { buildSharePayload, buildShareUrl } from '../lib/share';
import { publishMenu } from '../lib/publish';
import { supabaseEnabled } from '../lib/supabase';
import DestinatairesSheet from '../components/DestinatairesSheet';

function recipeName(r: Recipe, lang: Lang): string {
  return lang === 'ar' ? r.nom_ar || r.nom : r.nom;
}
function recipeIngredients(r: Recipe, lang: Lang): string {
  return lang === 'ar' ? r.ingredients_ar || r.ingredients : r.ingredients;
}

function mealLines(r: Recipe | undefined, lang: Lang): string {
  if (!r) return '';
  return `• ${recipeName(r, lang)}\n${recipeIngredients(r, lang)}`;
}

function dayText(jour: DayConfig, day: DayMenu, byId: Map<string, Recipe>, lang: Lang): string {
  const L = LABELS[lang];
  const title =
    lang === 'ar' ? `*${DAY_AR[jour.key] ?? jour.nom}*` : `*${jour.nom}* (${jour.type})`;
  const parts: string[] = [title];
  const dej = day.dejId ? byId.get(day.dejId) : undefined;
  const din = day.dinId ? byId.get(day.dinId) : undefined;
  if (dej) parts.push(`\n${L.dej.toUpperCase()}\n${mealLines(dej, lang)}`);
  if (din) parts.push(`\n${L.din.toUpperCase()}\n${mealLines(din, lang)}`);
  for (const id of day.extras) {
    const r = byId.get(id);
    if (r) parts.push(`\n${L.extra.toUpperCase()}\n${mealLines(r, lang)}`);
  }
  return parts.join('\n');
}

async function copy(text: string, onDone: () => void) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  onDone();
}

export default function CuisinierView() {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const [copied, setCopied] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('fr');
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [destOpen, setDestOpen] = useState(false);

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  const shareLink = async () => {
    const payload = buildSharePayload(SEED_CONFIG, week, byId, new Set());
    const url = buildShareUrl(payload);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ title: 'Menu de la semaine', text: 'Menu de la semaine 👇', url });
        return;
      }
    } catch {
      return; // partage annulé
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('Lien copié !');
    } catch {
      setShareMsg(url);
    }
    setTimeout(() => setShareMsg(null), 2500);
  };

  const shareWithAudio = async () => {
    setPublishing(true);
    try {
      const { url, audioCount } = await publishMenu(SEED_CONFIG, week, byId);
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: 'Menu de la semaine', text: 'Menu de la semaine 👇', url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg('Lien copié ! (' + audioCount + ' note(s) vocale(s))');
        setTimeout(() => setShareMsg(null), 3000);
      }
    } catch (e) {
      setShareMsg((e as Error).message);
      setTimeout(() => setShareMsg(null), 4000);
    } finally {
      setPublishing(false);
    }
  };

  const days = SEED_CONFIG.jours.filter((j) => {
    const d = week.days[j.key];
    return d.dejId || d.dinId || d.extras.length;
  });

  const weekText = days.map((j) => dayText(j, week.days[j.key], byId, lang)).join('\n\n────────\n\n');
  const ar = lang === 'ar';
  const L = LABELS[lang];

  const Meal = ({ labelKey, recipe }: { labelKey: keyof typeof L; recipe: Recipe }) => (
    <div className="cook-meal" dir={ar ? 'rtl' : 'ltr'} lang={ar ? 'ar' : 'fr'}>
      <div className="cook-meal__label">{L[labelKey]}</div>
      <div className="cook-meal__name">{recipeName(recipe, lang)}</div>
      <div className="cook-meal__ing">{recipeIngredients(recipe, lang)}</div>
      {ar && !recipe.ingredients_ar && (
        <div className="cook-meal__note">⚠︎ الترجمة غير متوفرة — النص بالفرنسية</div>
      )}
      <VoiceNote recipeId={recipe.id} recipeName={recipeName(recipe, lang)} lang={lang} />
    </div>
  );

  return (
    <div>
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

      {days.length === 0 && (
        <p className="empty-note">Compose d'abord un menu dans l'onglet « Composer ».</p>
      )}

      {days.length > 0 && (
        <>
          {supabaseEnabled && (
            <button className="btn" onClick={() => setDestOpen(true)}>
              {ar ? '👤 شارك مع شخص' : '👤 Partager à une personne (espace permanent)'}
            </button>
          )}
          {supabaseEnabled ? (
            <button className="btn btn--ghost" onClick={shareWithAudio} disabled={publishing}>
              {publishing
                ? 'Préparation du lien…'
                : ar
                  ? '🔗 شارك المنيو (مع الصوت)'
                  : '🔗 Partager le menu (lien ponctuel)'}
            </button>
          ) : (
            <button className="btn" onClick={shareLink}>
              {ar ? '🔗 شارك المنيو (رابط)' : '🔗 Partager le menu (lien)'}
            </button>
          )}
          {shareMsg && <div className="import-report">{shareMsg}</div>}
          <button className="btn btn--ghost" onClick={() => copy(weekText, () => flash('week'))}>
            {copied === 'week' ? '✓ Copié !' : ar ? '📋 نسخ الأسبوع كامل' : '📋 Copier toute la semaine'}
          </button>
        </>
      )}

      {days.map((jour) => {
        const day = week.days[jour.key];
        const dej = day.dejId ? byId.get(day.dejId) : undefined;
        const din = day.dinId ? byId.get(day.dinId) : undefined;
        return (
          <div className="card" key={jour.key}>
            <div className="cook-day__title" dir={ar ? 'rtl' : 'ltr'}>
              {ar ? DAY_AR[jour.key] ?? jour.nom : jour.nom}{' '}
              <span className="daycard__type">· {ar ? TYPE_AR[jour.type] ?? jour.type : jour.type}</span>
            </div>

            {dej && <Meal labelKey="dej" recipe={dej} />}
            {din && <Meal labelKey="din" recipe={din} />}
            {day.extras.map((id) => {
              const r = byId.get(id);
              return r ? <Meal key={id} labelKey="extra" recipe={r} /> : null;
            })}

            <button
              className="btn btn--ghost"
              onClick={() => copy(dayText(jour, day, byId, lang), () => flash(jour.key))}
            >
              {copied === jour.key
                ? '✓ Copié !'
                : ar
                  ? `📋 نسخ ${DAY_AR[jour.key] ?? jour.nom}`
                  : `📋 Copier ${jour.nom}`}
            </button>
          </div>
        );
      })}

      {destOpen && <DestinatairesSheet onClose={() => setDestOpen(false)} />}
    </div>
  );
}
