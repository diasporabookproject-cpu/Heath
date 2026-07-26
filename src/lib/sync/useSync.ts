import { useEffect, useRef } from 'react';
import type { Session } from '../supabase';
import { ensureFoyer } from '../auth';
import { switchFoyer, syncNow, push } from './engine';
import { foyerTransition } from './plan';
import { loadLastFoyer, saveLastFoyer, onDataChanged } from '../db';

// Contrôleur de sync (non bloquant, best-effort).
//
// Lot Identité & accès T2 — L'ADOPTION EST MORTE. Elle n'existait que pour
// rattraper des données créées SANS compte : union local↔cloud, dédup de packs,
// consentement de fusion, fenêtre « push interdit ». Le compte étant requis, les
// données naissent rattachées à un foyer — il n'y a plus rien à fusionner.
//
// Séquence par cycle (connexion ET retour au premier plan) :
//   foyer → transition (`foyerTransition`, pure et testée) :
//     • `same`         → cycle normal : push puis pull.
//     • `first-attach` → cycle normal AUSSI : le push téléverse les données locales
//                        dans le foyer qu'on vient de fonder (option A : rien à coder).
//     • `switch`       → le foyer d'ARRIVÉE fait foi : purge LOCALE puis pull SEUL.
//                        Jamais de push, sinon le contenu de l'ancien foyer se
//                        déverserait dans le nouveau.
//
// Le push débouncé s'abonne au signal générique de db.ts (tous les stores).

const PUSH_DEBOUNCE_MS = 2500;

export function useSync(session: Session | null, onChanged: () => void): void {
  const busy = useRef(false);
  // Foyer prêt pour le push débouncé (null tant qu'aucun cycle n'a abouti).
  const activeFoyer = useRef<string | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const fullSync = async (session: Session | null) => {
    if (!session || busy.current) return;
    busy.current = true;
    try {
      const { foyerId } = await ensureFoyer();
      if (!foyerId) return;
      const last = await loadLastFoyer();
      const transition = foyerTransition(last, foyerId);

      if (transition === 'switch') {
        activeFoyer.current = null; // pas de push tant que le contexte n'est pas établi
        const res = await switchFoyer(foyerId);
        onChangedRef.current(); // le local a changé (purgé, puis re-tiré)
        if (res.error) return; // pull raté : on retentera au prochain cycle
        await saveLastFoyer(foyerId);
        activeFoyer.current = foyerId;
        return;
      }

      const r = await syncNow(foyerId);
      if (r.error) return; // hors-ligne / transitoire : on retentera
      await saveLastFoyer(foyerId);
      activeFoyer.current = foyerId;
      if (r.changed) onChangedRef.current();
    } finally {
      busy.current = false;
    }
  };

  // Connexion / déconnexion.
  useEffect(() => {
    if (!session) {
      activeFoyer.current = null;
      return;
    }
    void fullSync(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Retour au premier plan → cycle complet.
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
  // uniquement quand un cycle a établi le contexte de foyer.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = onDataChanged(() => {
      if (!activeFoyer.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (activeFoyer.current) void push(activeFoyer.current);
      }, PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
