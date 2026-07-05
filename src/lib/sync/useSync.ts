import { useEffect, useRef } from 'react';
import type { Session } from '../supabase';
import { ensureFoyer } from '../auth';
import { adopt, push, syncNow } from './engine';
import { isFoyerAdopted, markFoyerAdopted } from '../db';
import { useStore } from '../../store/useStore';

// Contrôleur de sync (non bloquant, best-effort). À la connexion : résout le foyer,
// fait l'adoption UNE fois (Q1), puis un cycle push+pull. Ensuite : sync au focus,
// et push débouncé quand les données locales changent. Le heartbeat de fond est
// coupé (décision QC) — focus + post-change suffisent pour un mono-éditeur.

const PUSH_DEBOUNCE_MS = 2500;

export function useSync(session: Session | null, onChanged: () => void): void {
  const foyerRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Résolution foyer + adoption + 1er sync.
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      foyerRef.current = null;
      return;
    }
    void (async () => {
      const { foyerId } = await ensureFoyer();
      if (cancelled || !foyerId) return;
      foyerRef.current = foyerId;
      if (!(await isFoyerAdopted(foyerId))) {
        const res = await adopt(foyerId);
        await markFoyerAdopted(foyerId);
        if (res.changed && !cancelled) onChanged();
      }
      const res = await syncNow(foyerId);
      if (res.changed && !cancelled) onChanged();
    })();
    return () => {
      cancelled = true;
    };
  }, [session, onChanged]);

  // Sync au retour au premier plan.
  useEffect(() => {
    const onFocus = () => {
      const foyerId = foyerRef.current;
      if (!foyerId || busyRef.current || document.visibilityState === 'hidden') return;
      busyRef.current = true;
      void syncNow(foyerId)
        .then((r) => {
          if (r.changed) onChanged();
        })
        .finally(() => {
          busyRef.current = false;
        });
    };
    window.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [onChanged]);

  // Push débouncé à chaque changement local (le store couvre Cuisine ; les autres
  // stores partiront au prochain focus — push lit TOUS les stores de toute façon).
  useEffect(() => {
    const unsub = useStore.subscribe(() => {
      if (!foyerRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (foyerRef.current) void push(foyerRef.current);
      }, PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
