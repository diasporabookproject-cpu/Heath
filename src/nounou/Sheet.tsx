import { useEffect, useState, type ReactNode } from 'react';
import { useSheetBack } from '../ui/primitives';

// Bottom-sheet réutilisable (réutilise la coquille Cuisine cz-sheet/cz-overlay).

export default function Sheet({
  title,
  sub,
  onClose,
  children,
}: {
  title: ReactNode;
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
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {title}
            {sub && <small>{sub}</small>}
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">{children}</div>
      </div>
    </>
  );
}
