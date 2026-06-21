import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { buildShoppingList, formatQty, formatShoppingText } from '../lib/shopping';

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

export default function CoursesView() {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const groups = useMemo(
    () => buildShoppingList(SEED_CONFIG, week, byId),
    [week, byId],
  );
  const [copied, setCopied] = useState(false);

  // Cases à cocher (confort en magasin) — état local, non persisté.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setChecked((c) => ({ ...c, [k]: !c[k] }));

  const total = groups.reduce((n, g) => n + g.lines.length, 0);

  if (total === 0) {
    return (
      <p className="empty-note">
        Compose d'abord un menu dans l'onglet « Composer » : la liste de courses se génère
        automatiquement à partir des repas choisis.
      </p>
    );
  }

  return (
    <div>
      <p className="hint">
        Générée à partir des repas de la semaine ({total} articles), regroupée par rayon.
        Quantités estimées par portion — la collation et le kéfir quotidiens ne sont pas détaillés.
      </p>

      <button
        className="btn"
        onClick={() => copy(formatShoppingText(groups), () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })}
      >
        {copied ? '✓ Copié !' : '📋 Copier la liste'}
      </button>

      {groups.map((g) => (
        <div className="card" key={g.id}>
          <div className="lib-section__title" style={{ margin: '0 0 8px' }}>
            {g.label}
          </div>
          {g.lines.map((line, i) => {
            const k = g.id + ':' + line.name + ':' + i;
            const q = formatQty(line);
            return (
              <label
                key={k}
                className={'course-item' + (checked[k] ? ' course-item--done' : '')}
              >
                <input type="checkbox" checked={!!checked[k]} onChange={() => toggle(k)} />
                <span className="course-item__name">{line.name}</span>
                {q && <span className="course-item__qty">{q}</span>}
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
