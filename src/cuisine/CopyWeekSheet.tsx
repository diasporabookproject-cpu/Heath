import { useEffect, useMemo, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { loadAllWeeks } from '../lib/db';
import { dayHasAny } from '../lib/menu';
import type { Recipe, WeekMenu } from '../types';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 23 juin » à partir d'un id de semaine YYYY-MM-DD. */
function labelFromId(id: string): string {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return id;
  return `Semaine du ${parseInt(m[3], 10)} ${MOIS[parseInt(m[2], 10) - 1] ?? ''}`;
}

interface Props {
  onClose: () => void;
  toast: (m: string) => void;
}

/** FC14 — Copier le menu d'une semaine déjà composée dans la semaine courante. */
export default function CopyWeekSheet({ onClose, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const currentId = useStore((s) => s.week.id);
  const copyWeekInto = useStore((s) => s.copyWeekInto);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r] as [string, Recipe])), [recipes]);

  const [weeks, setWeeks] = useState<WeekMenu[]>([]);
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    void loadAllWeeks().then(setWeeks);
    return () => cancelAnimationFrame(t);
  }, []);

  const candidates = useMemo(() => {
    return weeks
      .filter((w) => w.id !== currentId)
      .map((w) => {
        const days = SEED_CONFIG.jours.map((j) => w.days[j.key]).filter(Boolean);
        const filled = days.filter(dayHasAny);
        return { id: w.id, days: w.days, count: filled.length };
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => (a.id < b.id ? 1 : -1)); // plus récentes d'abord
  }, [weeks, currentId, byId]);

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Copier une semaine
            <small>Réutilise un menu déjà composé</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          {candidates.length === 0 ? (
            <p className="cz-emptynote">Aucune semaine composée à copier pour l’instant.</p>
          ) : (
            <div style={{ paddingTop: 8 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 2px 12px', lineHeight: 1.4 }}>
                Copie le menu (composants compris) dans <b>{labelFromId(currentId)}</b>. Le contenu
                actuel sera remplacé.
              </p>
              {candidates.map((c) => (
                <button
                  key={c.id}
                  className="cz-pick"
                  onClick={() => {
                    copyWeekInto(c.days);
                    toast(`Menu copié depuis ${labelFromId(c.id)}`);
                    onClose();
                  }}
                >
                  <div className="cz-libtop">
                    <span className="nm" style={{ flex: 1, fontWeight: 600 }}>
                      {labelFromId(c.id)}
                    </span>
                  </div>
                  <div className="cz-cardmeta">
                    <span>
                      <b>{c.count}</b> jour{c.count > 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
