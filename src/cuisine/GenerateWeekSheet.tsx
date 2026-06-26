import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { generateRecipeDraft, aiAvailable, type RecipeDraft } from '../lib/ai';
import { estimateMacrosLocal } from '../lib/macros';
import { nextRecipeId } from '../lib/recipeId';
import type { CalciumFlag, Recipe, RecipeType } from '../types';
import { IconStar, IconLoader, IconSpark } from './icons';

// FC4 — Générateur de semaine hybride : d'abord les recettes Validé qui collent,
// puis complétion par IA (statut « à valider ») pour varier / combler le cold-start.
// Respecte les 🔒, évite les répétitions, applique les critères côté IA.

const PRESETS: { key: string; label: string; kcal: number }[] = [
  { key: 'Léger', label: 'Léger', kcal: 450 },
  { key: 'Équilibré', label: 'Équilibré', kcal: 600 },
  { key: 'Copieux', label: 'Copieux', kcal: 750 },
];
const DIETS = ['Sans gluten', 'Végétarien', 'Végan', 'Sans lactose', 'Riche en protéines', 'Halal'];
const AI_CAP = 6; // plafond d'appels IA par génération (coût/latence)

type Kind = 'dej' | 'din' | 'cf';
const TYPE_OF: Record<Kind, RecipeType> = { dej: 'Déjeuner', din: 'Dîner', cf: 'Coupe-faim' };

interface Props {
  onClose: () => void;
  toast: (m: string) => void;
}

export default function GenerateWeekSheet({ onClose, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const setSlot = useStore((s) => s.setSlot);
  const setExtras = useStore((s) => s.setExtras);
  const upsertRecipe = useStore((s) => s.upsertRecipe);

  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);

  const [persons, setPersons] = useState(4);
  const [meals, setMeals] = useState<Record<Kind, boolean>>({ dej: true, din: true, cf: false });
  const [preset, setPreset] = useState('Équilibré');
  const [diets, setDiets] = useState<Set<string>>(new Set(['Sans gluten']));
  const [free, setFree] = useState('');
  const [avoidRep, setAvoidRep] = useState(true);
  const [useAi, setUseAi] = useState(true);
  const [respectLocks, setRespectLocks] = useState(true);

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const toggleDiet = (d: string) =>
    setDiets((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  const targetKcal = PRESETS.find((p) => p.key === preset)!.kcal;

  const pickFromLibrary = (type: RecipeType, used: Set<string>): string | null => {
    const pool = recipes.filter((r) => r.type === type && r.statut === 'Validé' && !used.has(r.id));
    if (pool.length === 0) return null;
    // proche de la cible + jitter pour varier les générations successives
    pool.sort(
      (a, b) =>
        Math.abs(a.kcal - targetKcal) + Math.random() * 160 -
        (Math.abs(b.kcal - targetKcal) + Math.random() * 160),
    );
    return pool[0].id;
  };

  const aiIntention = (type: RecipeType): string =>
    [
      free.trim() || `${type.toLowerCase()} équilibré`,
      `type ${type}`,
      `~${targetKcal} kcal pour 1 portion`,
      `critères : ${[...diets].join(', ') || 'sans gluten'}`,
    ].join(' · ');

  const recipeFromDraft = (id: string, type: RecipeType, draft: RecipeDraft): Recipe => {
    const hasMacros = Number(draft.kcal) > 0;
    const est = hasMacros ? null : estimateMacrosLocal(draft.ingredients ?? '');
    return {
      id,
      nom: draft.nom?.trim() || `${type} (IA)`,
      type,
      statut: 'Test',
      jour: draft.jour || 'Tous',
      kcal: hasMacros ? Math.round(Number(draft.kcal)) : est!.kcal,
      prot: hasMacros ? Math.round(Number(draft.prot) || 0) : est!.prot,
      gluc: hasMacros ? Math.round(Number(draft.gluc) || 0) : est!.gluc,
      lip: hasMacros ? Math.round(Number(draft.lip) || 0) : est!.lip,
      calcium: hasMacros ? Math.round(Number(draft.calcium) || 0) : est!.calcium,
      flag_calcium: (draft.flag_calcium as CalciumFlag) || (est ? est.flag_calcium : 'Moyen'),
      ingredients: draft.ingredients?.trim() || '',
      etapes: draft.etapes?.trim() || undefined,
      macros_estimees: true,
      nom_ar: draft.nom_ar?.trim() || undefined,
      ingredients_ar: draft.ingredients_ar?.trim() || undefined,
      etapes_ar: draft.etapes_ar?.trim() || undefined,
    };
  };

  const run = async () => {
    if (!meals.dej && !meals.din && !meals.cf) {
      toast('Choisis au moins un repas à planifier');
      return;
    }
    setBusy(true);
    try {
      const avail = useAi ? await aiAvailable() : false;
      if (useAi && !avail) toast('IA indisponible (hors-ligne / non connecté) — depuis la bibliothèque');

      const used = new Set<string>();
      const tasks: { dayKey: string; kind: Kind; type: RecipeType }[] = [];

      for (const j of SEED_CONFIG.jours) {
        const d = week.days[j.key];
        (['dej', 'din'] as Kind[]).forEach((kind) => {
          if (!meals[kind]) return;
          const locked = kind === 'dej' ? d.lockDej : d.lockDin;
          const cur = kind === 'dej' ? d.dejId : d.dinId;
          if (respectLocks && locked) {
            if (cur) used.add(cur);
            return;
          }
          tasks.push({ dayKey: j.key, kind, type: TYPE_OF[kind] });
        });
        if (meals.cf) tasks.push({ dayKey: j.key, kind: 'cf', type: 'Coupe-faim' });
      }

      // ~25 % des créneaux passent par l'IA quand elle est dispo (variété), plafonné.
      const aiIdx = new Set<number>();
      if (avail) {
        const n = Math.min(AI_CAP, Math.max(1, Math.round(tasks.length * 0.25)));
        const order = tasks.map((_, i) => i).sort(() => Math.random() - 0.5);
        order.slice(0, n).forEach((i) => aiIdx.add(i));
      }

      const updates: { dayKey: string; kind: Kind; recipeId: string }[] = [];
      const aiQueue: { dayKey: string; kind: Kind; type: RecipeType }[] = [];

      tasks.forEach((task, i) => {
        const wantAi = aiIdx.has(i);
        if (wantAi) {
          aiQueue.push(task);
          return;
        }
        const fromLib = pickFromLibrary(task.type, avoidRep ? used : new Set());
        if (fromLib) {
          used.add(fromLib);
          updates.push({ ...task, recipeId: fromLib });
        } else if (avail) {
          aiQueue.push(task); // bibliothèque vide pour ce type → IA
        } else {
          const any = pickFromLibrary(task.type, new Set()); // repli : autoriser la répétition
          if (any) updates.push({ ...task, recipeId: any });
        }
      });

      // Génération IA (parallèle, plafonnée). Le surplus retombe sur la bibliothèque.
      const aiRun = aiQueue.slice(0, AI_CAP);
      const aiOverflow = aiQueue.slice(AI_CAP);
      aiOverflow.forEach((task) => {
        const any = pickFromLibrary(task.type, new Set());
        if (any) updates.push({ ...task, recipeId: any });
      });

      const drafts = await Promise.all(
        aiRun.map(async (task) => {
          try {
            return { task, draft: await generateRecipeDraft(aiIntention(task.type)) };
          } catch {
            return null;
          }
        }),
      );

      let aiCount = 0;
      const pool = [...recipes];
      for (const r of drafts) {
        if (!r) continue;
        const id = nextRecipeId(pool, r.task.type);
        const recipe = recipeFromDraft(id, r.task.type, r.draft);
        pool.push(recipe);
        upsertRecipe(recipe);
        updates.push({ ...r.task, recipeId: id });
        aiCount++;
      }

      // Application : créneaux + extras Coupe-faim (un seul par jour).
      const cfByDay: Record<string, string[]> = {};
      for (const u of updates) {
        if (u.kind === 'cf') (cfByDay[u.dayKey] ||= []).push(u.recipeId);
        else setSlot(u.dayKey, u.kind, u.recipeId);
      }
      for (const day of Object.keys(cfByDay)) setExtras(day, cfByDay[day]);

      const libCount = updates.length - aiCount;
      onClose();
      toast(
        `Semaine générée · ${libCount} depuis la bibliothèque` +
          (aiCount ? ` · ${aiCount} générée${aiCount > 1 ? 's' : ''} à valider` : ''),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={busy ? undefined : onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            Générer la semaine
            <small>Bibliothèque d’abord, IA pour compléter</small>
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer" disabled={busy}>
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          <div className="cz-block" style={{ marginTop: 2 }}>
            <div className="cz-blab">Personnes</div>
            <div className="cz-stepper">
              <button onClick={() => setPersons((p) => Math.max(1, p - 1))}>−</button>
              <div className="sv">{persons}</div>
              <button onClick={() => setPersons((p) => p + 1)}>+</button>
            </div>
          </div>

          <div className="cz-block">
            <div className="cz-blab">Repas à planifier</div>
            <div className="cz-dietchips">
              {(['dej', 'din', 'cf'] as Kind[]).map((k) => (
                <button
                  key={k}
                  className="cz-dchip"
                  aria-pressed={meals[k]}
                  onClick={() => setMeals((m) => ({ ...m, [k]: !m[k] }))}
                >
                  {TYPE_OF[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="cz-block">
            <div className="cz-blab">Cible calorique par repas</div>
            <div className="cz-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  className="cz-preset"
                  aria-pressed={preset === p.key}
                  onClick={() => setPreset(p.key)}
                >
                  {p.label}
                  <small>~{p.kcal}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="cz-block">
            <div className="cz-blab">Critères alimentaires</div>
            <div className="cz-dietchips">
              {DIETS.map((d) => (
                <button key={d} className="cz-dchip" aria-pressed={diets.has(d)} onClick={() => toggleDiet(d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="cz-block">
            <div className="cz-blab">Préférences (optionnel)</div>
            <textarea
              className="cz-ta"
              rows={2}
              value={free}
              onChange={(e) => setFree(e.target.value)}
              placeholder="Ex. plus de poisson, éviter les œufs le matin…"
            />
          </div>

          <div className="cz-crit">
            <CritRow
              label="Éviter les répétitions"
              on={avoidRep}
              onToggle={() => setAvoidRep((v) => !v)}
            />
            <CritRow
              label="Compléter avec l’IA si besoin"
              desc="Génère de nouvelles recettes (à valider)"
              on={useAi}
              onToggle={() => setUseAi((v) => !v)}
            />
            <CritRow
              label="Respecter les repas verrouillés"
              on={respectLocks}
              onToggle={() => setRespectLocks((v) => !v)}
            />
          </div>

          {useAi && (
            <div className="cz-gensource">
              <IconStar size={15} />
              <span>
                Les recettes générées par l’IA arrivent en <b>« à valider »</b> (macros estimées). Tu
                les relis et les valides avant qu’elles n’entrent dans ta bibliothèque.
              </span>
            </div>
          )}

          <button className="cz-cta" onClick={run} disabled={busy}>
            {busy ? <IconLoader size={17} className="cz-spin" /> : <IconSpark size={17} />}
            {busy ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>
    </>
  );
}

function CritRow({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string;
  desc?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="cz-critrow">
      <div className="cl">
        {label}
        {desc && <div className="d">{desc}</div>}
      </div>
      <button
        className={'cz-switch' + (on ? ' on' : '')}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
      />
    </div>
  );
}
