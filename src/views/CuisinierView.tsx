import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import type { DayConfig, DayMenu, Recipe } from '../types';

function mealLines(r: Recipe | undefined): string {
  if (!r) return '';
  return `• ${r.nom}\n${r.ingredients}`;
}

function dayText(jour: DayConfig, day: DayMenu, byId: Map<string, Recipe>): string {
  const parts: string[] = [`*${jour.nom}* (${jour.type})`];
  const dej = day.dejId ? byId.get(day.dejId) : undefined;
  const din = day.dinId ? byId.get(day.dinId) : undefined;
  if (dej) parts.push(`\nDÉJEUNER\n${mealLines(dej)}`);
  if (din) parts.push(`\nDÎNER\n${mealLines(din)}`);
  for (const id of day.extras) {
    const r = byId.get(id);
    if (r) parts.push(`\nEXTRA\n${mealLines(r)}`);
  }
  return parts.join('\n');
}

async function copy(text: string, onDone: () => void) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Repli si l'API Clipboard est indisponible (anciens navigateurs).
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

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  const days = SEED_CONFIG.jours.filter((j) => {
    const d = week.days[j.key];
    return d.dejId || d.dinId || d.extras.length;
  });

  const weekText = SEED_CONFIG.jours
    .filter((j) => {
      const d = week.days[j.key];
      return d.dejId || d.dinId || d.extras.length;
    })
    .map((j) => dayText(j, week.days[j.key], byId))
    .join('\n\n────────\n\n');

  return (
    <div>
      <p className="hint">
        Ingrédients pesés (1 portion). Les mesures à la cuillère (càc/càs) sont volontaires.
      </p>

      {days.length === 0 && (
        <p className="empty-note">Compose d'abord un menu dans l'onglet « Composer ».</p>
      )}

      {days.length > 0 && (
        <button
          className="btn"
          onClick={() => copy(weekText, () => flash('week'))}
        >
          {copied === 'week' ? '✓ Copié !' : '📋 Copier toute la semaine'}
        </button>
      )}

      {days.map((jour) => {
        const day = week.days[jour.key];
        const dej = day.dejId ? byId.get(day.dejId) : undefined;
        const din = day.dinId ? byId.get(day.dinId) : undefined;
        return (
          <div className="card" key={jour.key}>
            <div className="cook-day__title">
              {jour.nom} <span className="daycard__type">· {jour.type}</span>
            </div>

            {dej && (
              <div className="cook-meal">
                <div className="cook-meal__label">Déjeuner</div>
                <div className="cook-meal__name">{dej.nom}</div>
                <div className="cook-meal__ing">{dej.ingredients}</div>
              </div>
            )}
            {din && (
              <div className="cook-meal">
                <div className="cook-meal__label">Dîner</div>
                <div className="cook-meal__name">{din.nom}</div>
                <div className="cook-meal__ing">{din.ingredients}</div>
              </div>
            )}
            {day.extras.map((id) => {
              const r = byId.get(id);
              if (!r) return null;
              return (
                <div className="cook-meal" key={id}>
                  <div className="cook-meal__label">Extra</div>
                  <div className="cook-meal__name">{r.nom}</div>
                  <div className="cook-meal__ing">{r.ingredients}</div>
                </div>
              );
            })}

            <button
              className="btn btn--ghost"
              onClick={() => copy(dayText(jour, day, byId), () => flash(jour.key))}
            >
              {copied === jour.key ? '✓ Copié !' : `📋 Copier ${jour.nom}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
