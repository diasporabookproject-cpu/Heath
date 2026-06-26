import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { estimateMacros, generateRecipeDraft, aiAvailable } from '../lib/ai';
import { parseRecipesJson } from '../lib/importRecipes';
import { nextRecipeId } from '../lib/recipeId';
import type { CalciumFlag, Recipe, RecipeType } from '../types';
import { IconClock, IconStar, IconLoader, IconCheck, IconShareUp } from './icons';

const TYPES: RecipeType[] = ['Déjeuner', 'Dîner', 'Coupe-faim'];
const DIETS = ['Sans gluten', 'Végétarien', 'Végan', 'Sans lactose', 'Riche en protéines', 'Halal'];

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
  toast: (m: string) => void;
}

type Step = 'choose' | 'manual' | 'ai' | 'import';

export default function AddRecipeSheet({ onClose, onCreated, toast }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [shown, setShown] = useState(false);
  const [canAi, setCanAi] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    void aiAvailable().then(setCanAi);
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {step === 'choose'
              ? 'Ajouter une recette'
              : step === 'manual'
                ? 'Saisir une recette'
                : step === 'ai'
                  ? 'Générer avec l’IA'
                  : 'Importer (JSON)'}
            {step !== 'choose' && <small>Les macros sont calculées, pas saisies</small>}
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          {step === 'choose' && (
            <div style={{ paddingTop: 8 }}>
              <button className="cz-opt2" onClick={() => setStep('manual')}>
                <span className="ic pen">
                  <IconStar size={20} />
                </span>
                <span className="ot">
                  <span className="h">Saisir une recette</span>
                  <span className="d">Nom, ingrédients, étapes — les macros se calculent toutes seules.</span>
                </span>
              </button>
              <button
                className="cz-opt2"
                onClick={() => (canAi ? setStep('ai') : toast('Connecte-toi (☁︎) et sois en ligne pour l’IA'))}
                style={{ opacity: canAi ? 1 : 0.6 }}
              >
                <span className="ic ai">
                  <IconStar size={20} />
                </span>
                <span className="ot">
                  <span className="h">Générer avec l’IA</span>
                  <span className="d">
                    {canAi ? 'Un brouillon (nom, étapes, macros) à relire et valider.' : 'Indisponible hors-ligne / sans connexion.'}
                  </span>
                </span>
              </button>
              <button className="cz-opt2" onClick={() => setStep('import')}>
                <span className="ic pen">
                  <IconShareUp size={20} />
                </span>
                <span className="ot">
                  <span className="h">Importer (JSON)</span>
                  <span className="d">Coller un lot de recettes préparées ailleurs.</span>
                </span>
              </button>
            </div>
          )}

          {step === 'manual' && <ManualForm onCreated={onCreated} toast={toast} />}
          {step === 'ai' && <AiForm onCreated={onCreated} toast={toast} />}
          {step === 'import' && <ImportForm onClose={onClose} toast={toast} />}
        </div>
      </div>
    </>
  );
}

function MacroPreview({
  m,
}: {
  m: { kcal: number; prot: number; gluc: number; calcium: number } | null;
}) {
  if (!m) return null;
  return (
    <div className="cz-dmacros" style={{ marginTop: 10 }}>
      <div className="cz-dmcell"><div className="v">{m.kcal}</div><div className="l">kcal</div></div>
      <div className="cz-dmcell"><div className="v">{m.prot}</div><div className="l">prot</div></div>
      <div className="cz-dmcell"><div className="v">{m.gluc}</div><div className="l">gluc</div></div>
      <div className="cz-dmcell ca"><div className="v">{m.calcium}</div><div className="l">calcium</div></div>
    </div>
  );
}

function ManualForm({ onCreated, toast }: { onCreated: (id: string) => void; toast: (m: string) => void }) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [nom, setNom] = useState('');
  const [type, setType] = useState<RecipeType>('Déjeuner');
  const [ingredients, setIngredients] = useState('');
  const [etapes, setEtapes] = useState('');
  const [macros, setMacros] = useState<{ kcal: number; prot: number; gluc: number; lip: number; calcium: number; flag_calcium: CalciumFlag } | null>(null);
  const [calc, setCalc] = useState(false);

  const compute = async () => {
    if (!ingredients.trim()) {
      toast('Renseigne d’abord les ingrédients');
      return;
    }
    setCalc(true);
    const m = await estimateMacros(ingredients, type);
    setMacros(m);
    setCalc(false);
    toast(m.source === 'ia' ? 'Macros estimées par l’IA' : 'Macros estimées (base locale)');
  };

  const save = async () => {
    if (!nom.trim() || !ingredients.trim()) return;
    let m = macros;
    if (!m) {
      setCalc(true);
      m = await estimateMacros(ingredients, type);
      setCalc(false);
    }
    const id = nextRecipeId(recipes, type);
    const recipe: Recipe = {
      id,
      nom: nom.trim(),
      type,
      statut: 'Test', // à valider : macros estimées, validation explicite requise
      jour: 'Tous',
      kcal: m.kcal,
      prot: m.prot,
      gluc: m.gluc,
      lip: m.lip,
      calcium: m.calcium,
      flag_calcium: m.flag_calcium,
      ingredients: ingredients.trim(),
      etapes: etapes.trim() || undefined,
      macros_estimees: true,
    };
    upsertRecipe(recipe);
    onCreated(id);
  };

  return (
    <div>
      <div className="cz-block" style={{ marginTop: 2 }}>
        <div className="cz-blab">Nom</div>
        <input className="cz-inp" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
      </div>
      <div className="cz-block">
        <div className="cz-blab">Type</div>
        <div className="cz-dietchips">
          {TYPES.map((t) => (
            <button key={t} className="cz-dchip" aria-pressed={type === t} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="cz-block">
        <div className="cz-blab">Ingrédients pesés (1 portion)</div>
        <textarea
          className="cz-ta"
          rows={5}
          value={ingredients}
          onChange={(e) => { setIngredients(e.target.value); setMacros(null); }}
          placeholder="Poulet cuit 200g · riz cuit 110g · feta 40g · huile 1 càc"
        />
      </div>
      <div className="cz-block">
        <div className="cz-blab">Préparation (une étape par ligne)</div>
        <textarea
          className="cz-ta"
          rows={4}
          value={etapes}
          onChange={(e) => setEtapes(e.target.value)}
          placeholder={'Couper les légumes.\nAssaisonner et cuire 15 min.\nDresser.'}
        />
      </div>
      <div className="cz-block">
        <div className="cz-blab">Macros</div>
        <button className="cz-calcbtn" onClick={compute} disabled={calc}>
          {calc ? <IconLoader size={16} className="cz-spin" /> : <IconStar size={16} />}
          {calc ? 'Calcul…' : 'Calculer les macros à partir des ingrédients'}
        </button>
        <MacroPreview m={macros} />
        {macros && (
          <div className="cz-estnote" style={{ marginTop: 6 }}>
            <IconClock size={13} />
            Estimées · à valider
          </div>
        )}
      </div>
      <button className="cz-cta" onClick={save} disabled={!nom.trim() || !ingredients.trim() || calc}>
        <IconCheck size={17} />
        Enregistrer (à valider)
      </button>
    </div>
  );
}

function AiForm({ onCreated, toast }: { onCreated: (id: string) => void; toast: (m: string) => void }) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [intention, setIntention] = useState('');
  const [type, setType] = useState<RecipeType>('Dîner');
  const [persons, setPersons] = useState(4);
  const [diets, setDiets] = useState<Set<string>>(new Set(['Sans gluten']));
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof generateRecipeDraft>> | null>(null);
  const [err, setErr] = useState('');

  const toggleDiet = (d: string) =>
    setDiets((prev) => {
      const n = new Set(prev);
      if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });

  const generate = async () => {
    setStatus('loading');
    setErr('');
    const parts = [
      intention.trim() || `${type.toLowerCase()} équilibré`,
      `type ${type}`,
      `${persons} personne${persons > 1 ? 's' : ''}`,
      `critères : ${[...diets].join(', ') || 'sans gluten'}`,
    ];
    try {
      const d = await generateRecipeDraft(parts.join(' · '));
      setDraft(d);
      setStatus('ready');
    } catch (e) {
      setErr((e as Error).message);
      setStatus('error');
    }
  };

  const add = () => {
    if (!draft) return;
    const t = (TYPES.includes(draft.type as RecipeType) ? (draft.type as RecipeType) : type);
    const id = nextRecipeId(recipes, t);
    const recipe: Recipe = {
      id,
      nom: draft.nom?.trim() || 'Recette générée',
      type: t,
      statut: 'Test',
      jour: draft.jour || 'Tous',
      kcal: Math.round(Number(draft.kcal) || 0),
      prot: Math.round(Number(draft.prot) || 0),
      gluc: Math.round(Number(draft.gluc) || 0),
      lip: Math.round(Number(draft.lip) || 0),
      calcium: Math.round(Number(draft.calcium) || 0),
      flag_calcium: (draft.flag_calcium as CalciumFlag) || 'Moyen',
      ingredients: draft.ingredients?.trim() || '',
      etapes: draft.etapes?.trim() || undefined,
      macros_estimees: true,
      nom_ar: draft.nom_ar?.trim() || undefined,
      ingredients_ar: draft.ingredients_ar?.trim() || undefined,
      etapes_ar: draft.etapes_ar?.trim() || undefined,
    };
    upsertRecipe(recipe);
    toast('Brouillon ajouté — à valider');
    onCreated(id);
  };

  return (
    <div>
      <div className="cz-block" style={{ marginTop: 2 }}>
        <div className="cz-blab">Ce que tu veux</div>
        <textarea
          className="cz-ta"
          rows={3}
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="Ex. poisson au four, riche en calcium, ~600 kcal"
          autoFocus
        />
      </div>
      <div className="cz-block">
        <div className="cz-blab">Type</div>
        <div className="cz-dietchips">
          {TYPES.map((t) => (
            <button key={t} className="cz-dchip" aria-pressed={type === t} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="cz-block">
        <div className="cz-blab">Personnes</div>
        <div className="cz-stepper">
          <button onClick={() => setPersons((p) => Math.max(1, p - 1))}>−</button>
          <div className="sv">{persons}</div>
          <button onClick={() => setPersons((p) => p + 1)}>+</button>
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

      {status !== 'ready' && (
        <button className="cz-cta draft" onClick={generate} disabled={status === 'loading'}>
          {status === 'loading' ? <IconLoader size={17} className="cz-spin" /> : <IconStar size={17} />}
          {status === 'loading' ? 'Génération…' : 'Générer un brouillon'}
        </button>
      )}
      {status === 'error' && (
        <div className="cz-review" style={{ marginTop: 12 }}>{err}</div>
      )}

      {status === 'ready' && draft && (
        <>
          <div className="cz-librow draft" style={{ marginTop: 14, cursor: 'default' }}>
            <div className="cz-libtop">
              <span className="nm" style={{ fontWeight: 600 }}>{draft.nom}</span>
              <span className="cz-tag draft">✦ À valider</span>
            </div>
            <MacroPreview m={{ kcal: Number(draft.kcal) || 0, prot: Number(draft.prot) || 0, gluc: Number(draft.gluc) || 0, calcium: Number(draft.calcium) || 0 }} />
          </div>
          <button className="cz-cta" onClick={add}>
            <IconCheck size={17} />
            Modifier ou valider (→ fiche)
          </button>
          <button className="cz-cta ghost" onClick={() => setStatus('idle')}>
            Régénérer
          </button>
        </>
      )}
    </div>
  );
}

function ImportForm({ onClose, toast }: { onClose: () => void; toast: (m: string) => void }) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [text, setText] = useState('');
  const [report, setReport] = useState<{ ok: number; errors: string[] } | null>(null);

  const doImport = () => {
    const { recipes: parsed, errors } = parseRecipesJson(text, recipes);
    parsed.forEach(upsertRecipe);
    setReport({ ok: parsed.length, errors });
    if (parsed.length > 0 && errors.length === 0) {
      toast(`${parsed.length} recette(s) importée(s)`);
      setTimeout(onClose, 800);
    }
  };

  return (
    <div>
      <div className="cz-review" style={{ marginTop: 8 }}>
        Colle un tableau JSON de recettes (ou une seule). Les identifiants manquants sont générés ; le
        flag calcium est déduit s’il est absent.
      </div>
      <div className="cz-block">
        <textarea
          className="cz-ta"
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='[ { "nom": "...", "type": "Déjeuner", "kcal": 750, ... } ]'
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
        />
      </div>
      {report && (
        <div className="cz-review" style={{ marginTop: 12 }}>
          ✓ {report.ok} recette(s) importée(s).
          {report.errors.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {report.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button className="cz-cta" onClick={doImport} disabled={!text.trim()}>
        <IconCheck size={17} />
        Importer
      </button>
    </div>
  );
}
