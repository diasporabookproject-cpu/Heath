import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { parseRecipesJson } from '../lib/importRecipes';
import type { CalciumFlag, Recipe, RecipeType } from '../types';

const TYPES: RecipeType[] = ['Déjeuner', 'Dîner', 'Coupe-faim'];
const PREFIX: Record<RecipeType, string> = {
  Déjeuner: 'DEJ',
  Dîner: 'DIN',
  'Coupe-faim': 'CF',
};

function nextId(recipes: Recipe[], type: RecipeType): string {
  const prefix = PREFIX[type];
  let max = 0;
  for (const r of recipes) {
    const m = r.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

export default function BibliothequeView() {
  const recipes = useStore((s) => s.recipes);
  const setStatut = useStore((s) => s.setStatut);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);

  const grouped = useMemo(() => {
    return TYPES.map((type) => ({
      type,
      items: recipes
        .filter((r) => r.type === type)
        .sort((a, b) => {
          // Validé d'abord, puis Test, puis Écarté
          const order = (s: Recipe['statut']) => (s === 'Validé' ? 0 : s === 'Test' ? 1 : 2);
          return order(a.statut) - order(b.statut) || a.nom.localeCompare(b.nom, 'fr');
        }),
    }));
  }, [recipes]);

  return (
    <div>
      <button className="btn" onClick={() => setAdding(true)}>
        + Ajouter une recette
      </button>
      <button className="btn btn--ghost" onClick={() => setImporting(true)}>
        ⇪ Importer (JSON)
      </button>

      {grouped.map((g) => (
        <div key={g.type}>
          <div className="lib-section__title">{g.type}</div>
          <div className="card">
            {g.items.length === 0 && <p className="empty-note">Aucune recette.</p>}
            {g.items.map((r) => (
              <div
                key={r.id}
                className={'lib-item' + (r.statut === 'Écarté' ? ' lib-item--ecarte' : '')}
              >
                <button className="lib-item__main lib-item__edit" onClick={() => setEditing(r)}>
                  <div className="lib-item__name">{r.nom}</div>
                  <div className="lib-item__sub">
                    {r.type} · {r.kcal} kcal · P {r.prot} · Ca {r.calcium} mg{' '}
                    <span className={'flag flag--' + r.flag_calcium}>{r.flag_calcium}</span>
                    {r.statut === 'Test' && ' · Test'}
                  </div>
                </button>
                <button
                  className="lib-toggle"
                  onClick={() => setStatut(r.id, r.statut === 'Écarté' ? 'Validé' : 'Écarté')}
                >
                  {r.statut === 'Écarté' ? 'Réactiver' : 'Écarter'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {adding && <RecipeFormSheet onClose={() => setAdding(false)} />}
      {editing && <RecipeFormSheet recipe={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportRecipesSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

function ImportRecipesSheet({ onClose }: { onClose: () => void }) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [text, setText] = useState('');
  const [report, setReport] = useState<{ ok: number; errors: string[] } | null>(null);

  const doImport = () => {
    const { recipes: parsed, errors } = parseRecipesJson(text, recipes);
    for (const r of parsed) upsertRecipe(r);
    setReport({ ok: parsed.length, errors });
    if (parsed.length > 0 && errors.length === 0) setTimeout(onClose, 900);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title">
            <span>Importer des recettes (JSON)</span>
            <button className="sheet__close" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
        <div className="sheet__list">
          <p className="hint">
            Colle un tableau JSON de recettes (ou une seule). Les identifiants manquants sont
            générés ; le flag calcium est déduit s'il est absent.
          </p>
          <div className="field">
            <textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='[ { "nom": "...", "type": "Déjeuner", "kcal": 750, ... } ]'
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>
          {report && (
            <div className={'import-report' + (report.errors.length ? ' import-report--warn' : '')}>
              ✓ {report.ok} recette(s) importée(s).
              {report.errors.length > 0 && (
                <ul>
                  {report.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button className="btn" onClick={doImport} disabled={!text.trim()}>
            Importer
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeFormSheet({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const isEdit = !!recipe;
  const numStr = (n: number | undefined) => (n != null ? String(n) : '');

  const [nom, setNom] = useState(recipe?.nom ?? '');
  const [type, setType] = useState<RecipeType>(recipe?.type ?? 'Déjeuner');
  const [jour, setJour] = useState(recipe?.jour ?? 'Tous');
  const [kcal, setKcal] = useState(numStr(recipe?.kcal));
  const [prot, setProt] = useState(numStr(recipe?.prot));
  const [gluc, setGluc] = useState(numStr(recipe?.gluc));
  const [lip, setLip] = useState(numStr(recipe?.lip));
  const [calcium, setCalcium] = useState(numStr(recipe?.calcium));
  const [flag, setFlag] = useState<CalciumFlag>(recipe?.flag_calcium ?? 'Moyen');
  const [ingredients, setIngredients] = useState(recipe?.ingredients ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [nomAr, setNomAr] = useState(recipe?.nom_ar ?? '');
  const [ingredientsAr, setIngredientsAr] = useState(recipe?.ingredients_ar ?? '');

  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const canSave = nom.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const next: Recipe = {
      id: recipe ? recipe.id : nextId(recipes, type),
      nom: nom.trim(),
      type,
      statut: recipe ? recipe.statut : 'Validé',
      jour,
      kcal: num(kcal),
      prot: num(prot),
      gluc: num(gluc),
      lip: num(lip),
      calcium: num(calcium),
      flag_calcium: flag,
      ingredients: ingredients.trim(),
      notes: notes.trim() || undefined,
      nom_ar: nomAr.trim() || undefined,
      ingredients_ar: ingredientsAr.trim() || undefined,
    };
    upsertRecipe(next);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title">
            <span>{isEdit ? 'Modifier la recette' : 'Nouvelle recette'}</span>
            <button className="sheet__close" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
        <div className="sheet__list">
          <div className="field">
            <label>Nom</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as RecipeType)}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Jour adapté</label>
              <select value={jour} onChange={(e) => setJour(e.target.value)}>
                <option>Tous</option>
                <option>Repos</option>
                <option>Sport</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>kcal</label>
              <input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </div>
            <div className="field">
              <label>Protéines (g)</label>
              <input inputMode="numeric" value={prot} onChange={(e) => setProt(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Glucides (g)</label>
              <input inputMode="numeric" value={gluc} onChange={(e) => setGluc(e.target.value)} />
            </div>
            <div className="field">
              <label>Lipides (g)</label>
              <input inputMode="numeric" value={lip} onChange={(e) => setLip(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Calcium (mg)</label>
              <input
                inputMode="numeric"
                value={calcium}
                onChange={(e) => setCalcium(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Flag calcium</label>
              <select value={flag} onChange={(e) => setFlag(e.target.value as CalciumFlag)}>
                <option>Champion</option>
                <option>Moyen</option>
                <option>Faible</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Ingrédients pesés (1 portion)</label>
            <textarea
              rows={4}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Ex. Poulet cuit 200g · riz cuit 110g · …"
            />
          </div>
          <div className="field">
            <label>Notes (optionnel)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="field">
            <label>الاسم بالدارجة (اختياري)</label>
            <input dir="rtl" value={nomAr} onChange={(e) => setNomAr(e.target.value)} />
          </div>
          <div className="field">
            <label>المكونات بالدارجة (اختياري)</label>
            <textarea
              dir="rtl"
              rows={4}
              value={ingredientsAr}
              onChange={(e) => setIngredientsAr(e.target.value)}
            />
          </div>
          <button className="btn" onClick={save} disabled={!canSave}>
            {isEdit ? 'Enregistrer les modifications' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
