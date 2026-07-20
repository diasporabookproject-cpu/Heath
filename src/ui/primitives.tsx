import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './mz.css';

// Primitives du design system Manzil (mz-). Fidèles au prototype v6.1.
// Réutilisées par les pages de rôle et l'écran Maison (Lots 1-2).

export type Role = 'cuisine' | 'nounou';
const ROLE_CLASS: Record<Role, string> = { cuisine: 'grn', nounou: 'vio' };

// ── Pile GLOBALE des feuilles ouvertes (B3 coquille) ──────────────────────────
// Le bouton retour Android doit fermer la feuille LA PLUS HAUTE avant toute
// navigation. Chaque feuille montée s'enregistre (le composant `Sheet` le fait
// tout seul ; les feuilles maison type `cz-sheet` appellent `useSheetBack`).
// Sur le web la pile existe mais personne ne la consomme — inerte, zéro coût.
const sheetStack: Array<() => void> = [];

/** Ferme la feuille la plus haute. `false` si aucune feuille n'est ouverte. */
export function closeTopSheet(): boolean {
  const top = sheetStack[sheetStack.length - 1];
  if (!top) return false;
  top();
  return true;
}

/** Enregistre la feuille montée dans la pile (montage = ouverture — toutes nos
 * feuilles sont montées conditionnellement). Une ligne par feuille maison. */
export function useSheetBack(onClose: () => void): void {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const close = () => ref.current();
    sheetStack.push(close);
    return () => {
      const i = sheetStack.indexOf(close);
      if (i >= 0) sheetStack.splice(i, 1);
    };
  }, []);
}

/** Racine d'un écran mz (gère le sens RTL). `className` : variante DA (ex. `b1`). */
export function MzScreen({ rtl = false, className, children }: { rtl?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={'mz' + (className ? ' ' + className : '')} dir={rtl ? 'rtl' : 'ltr'}>
      {children}
    </div>
  );
}

/** Zone défilante centrée (max-width). */
export function MzScroll({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="mz-scroll" style={style}>
      {children}
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
}

/** En-tête de page de rôle : héros dégradé + retour + langue + segments. */
export function PageHero({
  role,
  picto,
  title,
  status,
  onBack,
  backLabel = '‹ Maison',
  lang,
  segments,
  active,
  onSeg,
}: {
  role: Role;
  picto: string;
  title: string;
  status?: ReactNode;
  onBack: () => void;
  backLabel?: string;
  lang?: { label: string; onClick: () => void };
  segments?: Segment[];
  active?: string;
  onSeg?: (key: string) => void;
}) {
  return (
    <div className={'mz-pgh ' + ROLE_CLASS[role]}>
      <span className="halo" />
      <div className="hrow">
        <button className="back" onClick={onBack}>
          {backLabel}
        </button>
        {lang && (
          <button className="lang" onClick={lang.onClick}>
            {lang.label} ▾
          </button>
        )}
      </div>
      <div className="who">
        <span className="g">{picto}</span>
        <div>
          <h3>{title}</h3>
          {status && <div className="st">{status}</div>}
        </div>
      </div>
      {segments && segments.length > 0 && (
        <div className="seg" role="tablist">
          {segments.map((s) => (
            <button
              key={s.key}
              className={'mz-sgi' + (active === s.key ? ' on' : '')}
              role="tab"
              aria-selected={active === s.key}
              onClick={() => onSeg?.(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barre d'action basse fixe : [＋ contextuel] [CTA]. */
export function ActionBar({
  onPlus,
  plusLabel = 'Ajouter',
  cta,
  onCta,
}: {
  onPlus: () => void;
  plusLabel?: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div className="mz-abar">
      <button className="plus" onClick={onPlus} aria-label={plusLabel}>
        ＋
      </button>
      <button className="cta" onClick={onCta}>
        {cta}
      </button>
    </div>
  );
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={'mz-card ' + className} {...rest}>
      {children}
    </div>
  );
}

/** Pastille d'action ambre (Envoyer / Briefer / Planifier). */
export function Pill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="mz-pill" onClick={onClick}>
      {label}
    </button>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="mz-fchips">{children}</div>;
}

export function Chip({ label, on, onClick }: { label: string; on?: boolean; onClick: () => void }) {
  return (
    <button className={'mz-fc' + (on ? ' on' : '')} aria-pressed={!!on} onClick={onClick}>
      {label}
    </button>
  );
}

/** Bottom-sheet animé (overlay + poignée + titre + contenu défilant). */
export function Sheet({
  title,
  sub,
  onClose,
  children,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div className={'mz-ovl' + (shown ? ' on' : '')} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mz-sheet" role="dialog" aria-modal="true">
        <div className="mz-grab" />
        <div className="mz-shscroll">
          {title && <div className="mz-sh-t">{title}</div>}
          {sub && <div className="mz-sm" style={{ margin: '4px 0 12px' }}>{sub}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Toast contrôlé + hook de pilotage. */
export function useToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2300);
  }, []);
  const node = <div className={'mz-toast' + (msg ? ' on' : '')}>{msg}</div>;
  return { toast, node };
}
