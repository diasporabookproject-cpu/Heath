import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { cleanText } from '../lib/sanitize';
import { ROLE_LABEL } from '../types';

// L3-3 — File de relecture des brouillons IA : validation regroupée en un flux
// unique (proto v6.1 `sh-relecture`). Périmètre = recettes `statut: 'Test'`
// (toutes, migration douce des anciennes). À NE PAS confondre avec la relecture
// des traductions Nounou (`TraductionSheet`), qui existe et ne bouge pas.

interface Props {
  /** Recette par laquelle démarrer (tap sur une ligne « à valider »). */
  startId?: string;
  onClose: () => void;
  onOpenRecipe: (id: string) => void;
  toast: (m: string) => void;
}

export default function RelectureSheet({ startId, onClose, onOpenRecipe, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const validateRecipe = useStore((s) => s.validateRecipe);
  const setStatut = useStore((s) => s.setStatut);

  const [shown, setShown] = useState(false);
  // File figée au montage (ordre stable) — les actions font avancer l'index.
  const [queue] = useState<string[]>(() => recipes.filter((r) => r.statut === 'Test').map((r) => r.id));
  const [idx, setIdx] = useState(() => {
    const i = startId ? queue.indexOf(startId) : 0;
    return i < 0 ? 0 : i;
  });

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const total = queue.length;
  const cur = idx < total ? recipes.find((r) => r.id === queue[idx]) : undefined;

  const finish = () => {
    onClose();
    toast('Bibliothèque impeccable ✓');
  };
  const step = () => {
    if (idx + 1 >= total) finish();
    else setIdx(idx + 1);
  };

  const valider = () => {
    if (cur) validateRecipe(cur.id);
    step();
  };
  const supprimer = () => {
    if (cur) setStatut(cur.id, 'Écarté');
    step();
  };
  const modifier = () => {
    if (!cur) return;
    onClose();
    onOpenRecipe(cur.id);
  };

  // Le sanitizer nettoie au rendu ; s'il change qqch, c'est un artefact IA à corriger.
  const warn =
    !!cur && (cleanText(cur.nom) !== cur.nom.trim() || cleanText(cur.ingredients) !== cur.ingredients.trim());

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Relecture express
            {total > 0 && <small>Brouillons IA — 2 minutes et c’est réglé</small>}
          </div>
          <span className="cz-relprog">{Math.min(idx + 1, total)} / {total}</span>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-relbar">
            <i style={{ width: (total ? ((idx + 1) / total) * 100 : 100) + '%' }} />
          </div>

          {cur ? (
            <>
              <div className="cz-librow" style={{ cursor: 'default', marginTop: 12 }}>
                <div className="cz-libtop">
                  <span className="nm clamp2" style={{ fontWeight: 600, flex: 1 }}>{cleanText(cur.nom)}</span>
                  <span className="cz-tag role">{ROLE_LABEL[cur.role]}</span>
                </div>
                <div className="cz-macros">
                  <span><b>{cur.kcal}</b> kcal · <b>{cur.prot}</b>g P · <b>{cur.calcium}</b>mg Ca</span>
                </div>
              </div>

              <div className="cz-relbody">{cleanText(cur.ingredients) || 'Pas d’ingrédients.'}</div>
              {cur.etapes && <div className="cz-relbody">{cleanText(cur.etapes)}</div>}

              {warn && (
                <div className="cz-relwarn">
                  ⚠ Texte suspect détecté (artefact IA) — à corriger via « Modifier ».
                </div>
              )}

              <div className="cz-relbtns">
                <button className="cz-cta ghost" onClick={supprimer}>Supprimer</button>
                <button className="cz-cta ghost" onClick={modifier}>Modifier</button>
                <button className="cz-cta" onClick={valider}>Valider →</button>
              </div>
            </>
          ) : (
            <div className="cz-relempty">
              <div style={{ fontSize: 34 }}>✓</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>Bibliothèque impeccable</div>
              <button className="cz-cta" style={{ marginTop: 14 }} onClick={onClose}>Fermer</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
