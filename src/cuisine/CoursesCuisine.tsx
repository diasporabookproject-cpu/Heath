import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { buildShoppingList, formatQty, formatShoppingText } from '../lib/shopping';
import { cleanText, cleanQty } from '../lib/sanitize';
import { IconShareUp, IconCheck } from './icons';

// FC8 — Liste de courses : générée depuis la semaine, mise à l'échelle ×personnes,
// groupée par rayon, cochable, partageable (WhatsApp / copie).

interface Props {
  toast: (m: string) => void;
}

export default function CoursesCuisine({ toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const persons = useStore((s) => s.settings.persons);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => buildShoppingList(SEED_CONFIG, week, byId, persons),
    [week, byId, persons],
  );
  const total = groups.reduce((n, g) => n + g.lines.length, 0);

  const share = async () => {
    const text = formatShoppingText(groups);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ title: 'Liste de courses', text });
        return;
      }
    } catch {
      /* annulé → repli copie */
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Liste copiée (prête pour WhatsApp)');
    } catch {
      toast('Copie impossible');
    }
  };

  if (total === 0) {
    return (
      <p className="cz-emptynote">
        Compose un menu dans l’onglet « Semaine » : la liste de courses se génère toute seule.
      </p>
    );
  }

  return (
    <div>
      <div className="cz-coursehead">
        <span className="ci">
          <b>{total}</b> article{total > 1 ? 's' : ''}
        </span>
        <button className="cz-shareb" onClick={share}>
          <IconShareUp size={14} />
          Partager
        </button>
      </div>

      <div className="cz-persons">
        <span className="pl">
          Quantités pour <b>{persons}</b> personne{persons > 1 ? 's' : ''} · réglable dans Objectif
        </span>
      </div>

      <div className="cz-courses">
        {groups.map((g) => (
          <div key={g.id}>
            <div className="cz-rayon">
              {g.label}
              <span />
            </div>
            <div className="cz-colist">
              {g.lines.map((l) => {
                const k = g.id + '|' + l.name + '|' + (l.unit ?? '');
                const done = !!checked[k];
                const q = formatQty(l);
                return (
                  <button
                    key={k}
                    className={'cz-coitem' + (done ? ' done' : '')}
                    onClick={() => setChecked((c) => ({ ...c, [k]: !c[k] }))}
                  >
                    <span className="cz-cobox">
                      <IconCheck size={13} />
                    </span>
                    <span className="cz-coname clamp2">{cleanText(l.name)}</span>
                    {q && <span className="cz-coqty">{cleanQty(q)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
