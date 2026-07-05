import { useEffect, useRef } from 'react';
import type { Session } from '../supabase';
import { ensureFoyer } from '../auth';
import { adopt, remoteHasDocs, syncNow, push } from './engine';
import { loadLastFoyer, saveLastFoyer, clearSyncState, onDataChanged } from '../db';

// Contrôleur de sync (non bloquant, best-effort).
// Séquence par cycle (login ET focus — un échec d'adoption se retente donc) :
//   foyer → si nouveau contexte (≠ lastFoyer) : purge méta + ADOPTION (avec
//   consentement explicite si le foyer a déjà du contenu cloud — rituel Q1) →
//   seulement alors le foyer devient « actif » → push/pull.
// Le push débouncé n'écoute plus le seul store cuisine : il s'abonne au signal
// générique de db.ts (tous les stores) et n'agit que sur un foyer ACTIF (donc
// jamais pendant la fenêtre d'adoption — l'invariant « cloud gagne » tient).

const PUSH_DEBOUNCE_MS = 2500;

export interface AdoptRequest {
  foyerId: string;
  /** À appeler après consentement (fera l'adoption puis activera la sync). */
  proceed: () => void;
}

export function useSync(
  session: Session | null,
  onChanged: () => void,
  onAskAdopt: (req: AdoptRequest) => void,
): void {
  // Foyer ACTIF = adoption établie, push/pull autorisés. Null tant que non prêt.
  const activeFoyer = useRef<string | null>(null);
  const busy = useRef(false);
  const asked = useRef<string | null>(null); // consentement déjà demandé (par foyer, par session)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // refs stables vers les callbacks (évite de re-câbler les effets).
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const onAskAdoptRef = useRef(onAskAdopt);
  onAskAdoptRef.current = onAskAdopt;

  const adoptInto = async (foyerId: string) => {
    // Contexte neuf : purge la méta/curseurs de l'ancien foyer (jamais réutilisés).
    await clearSyncState();
    const res = await adopt(foyerId);
    if (res.error) return false; // on ne marque RIEN : retentera au prochain cycle
    await saveLastFoyer(foyerId);
    if (res.changed) onChangedRef.current();
    return true;
  };

  const fullSync = async (session: Session | null) => {
    if (!session || busy.current) return;
    busy.current = true;
    try {
      const { foyerId } = await ensureFoyer();
      if (!foyerId) return;
      const last = await loadLastFoyer();
      if (last !== foyerId) {
        activeFoyer.current = null; // fenêtre d'adoption : push interdit
        const has = await remoteHasDocs(foyerId);
        if (has === null) return; // indéterminable (hors-ligne) : cycle suivant
        if (has) {
          // Foyer déjà peuplé → consentement explicite (rituel Q1), une fois par session.
          if (asked.current !== foyerId) {
            asked.current = foyerId;
            onAskAdoptRef.current({
              foyerId,
              proceed: () => {
                void (async () => {
                  if (await adoptInto(foyerId)) {
                    activeFoyer.current = foyerId;
                    const r = await syncNow(foyerId);
                    if (r.changed) onChangedRef.current();
                  }
                })();
              },
            });
          }
          return; // pas de sync tant que non consenti
        }
        if (!(await adoptInto(foyerId))) return;
      }
      activeFoyer.current = foyerId;
      const r = await syncNow(foyerId);
      if (r.changed) onChangedRef.current();
    } finally {
      busy.current = false;
    }
  };

  // Connexion / déconnexion.
  useEffect(() => {
    if (!session) {
      activeFoyer.current = null;
      asked.current = null;
      return;
    }
    void fullSync(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Retour au premier plan → cycle complet (retente aussi une adoption échouée).
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
      void fullSync(session);
    };
    window.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Push débouncé sur TOUT changement de données (signal générique db.ts) —
  // uniquement quand le foyer est actif (adoption établie).
  useEffect(() => {
    const unsub = onDataChanged(() => {
      if (!activeFoyer.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (activeFoyer.current) void push(activeFoyer.current);
      }, PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

}
