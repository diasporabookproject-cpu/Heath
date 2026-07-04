import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { estimateMacros, generateRecipeDraft, importRecipeText, aiAvailable } from '../lib/ai';
import { parseRecipesJson } from '../lib/importRecipes';
import { nextRecipeId } from '../lib/recipeId';
import { remaining, normalizeQuota, currentMonth } from '../lib/quota';
import { ROLE_LABEL, type CalciumFlag, type Recipe, type RecipeRole } from '../types';
import { IconStar, IconLoader, IconCheck } from './icons';

const ROLES: RecipeRole[] = ['petitdej', 'entree', 'plat', 'acc'];

function roleFromDraft(v: unknown): RecipeRole {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.startsWith('petit')) return 'petitdej';
  if (s.startsWith('entr') || s.startsWith('coupe')) return 'entree';
  if (s.startsWith('acc') || s.startsWith('garniture')) return 'acc';
  return 'plat';
}

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
  toast: (m: string) => void;
}

type Step = 'choose' | 'dup' | 'manual' | 'ai' | 'importjson';

/** Valeurs de départ pour la saisie manuelle (duplication « copier puis adapter »). */
type ManualSeed = Pick<Recipe, 'nom' | 'role' | 'ingredients' | 'etapes' | 'kcal' | 'prot' | 'gluc' | 'lip' | 'calcium' | 'flag_calcium'>;

/**
 * L3-2 — Création « 3 portes » égales. L'IA est un accélérateur optionnel, jamais
 * un péage : la saisie manuelle reste toujours gratuite et illimitée.
 *  ① Depuis la bibliothèque (collections L3-4 ; repli : dupliquer une recette)
 *  ② Saisie manuelle → naît `Validé` (c'est la recette de l'auteur)
 *  ③ ✦ Coup de main IA (colle OU décris) → brouillon `Test` (file de relecture) + quota
 */
export default function AddRecipeSheet({ onClose, onCreated, toast }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [shown, setShown] = useState(false);
  const [canAi, setCanAi] = useState(false);
  const [seed, setSeed] = useState<ManualSeed | null>(null);
  const app = useStore((s) => s.app);
  const rem = remaining(normalizeQuota(app.aiQuota, currentMonth()));

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    void aiAvailable().then(setCanAi);
    return () => cancelAnimationFrame(t);
  }, []);

  const openAi = () => {
    if (!canAi) return toast('Connecte-toi (☁︎) et sois en ligne pour le coup de main IA');
    if (rem <= 0) return toast('Quota du mois épuisé — la saisie manuelle reste illimitée');
    setStep('ai');
  };

  const title =
    step === 'choose'
      ? 'Nouvelle recette'
      : step === 'dup'
        ? 'Copier une recette'
        : step === 'manual'
          ? 'Saisie manuelle'
          : step === 'ai'
            ? '✦ Coup de main IA'
            : 'Importer (JSON)';

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {title}
            {(step === 'manual' || step === 'dup') && <small>Les macros sont calculées, pas saisies</small>}
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          {step === 'choose' && (
            <div style={{ paddingTop: 8 }}>
              <button className="cz-opt2" onClick={() => setStep('dup')}>
                <span className="ic imp">📚</span>
                <span className="ot">
                  <span className="h">Depuis la bibliothèque</span>
                  <span className="d">Pioche une recette existante et adapte-la en 30 secondes.</span>
                </span>
              </button>
              <button className="cz-opt2" onClick={() => { setSeed(null); setStep('manual'); }}>
                <span className="ic pen">✍️</span>
                <span className="ot">
                  <span className="h">Saisie manuelle</span>
                  <span className="d">Pas à pas — toujours gratuit, toujours illimité.</span>
                </span>
              </button>
              <button className="cz-opt2" onClick={openAi} style={{ opacity: canAi && rem > 0 ? 1 : 0.6 }}>
                <span className="ic ai">✦</span>
                <span className="ot">
                  <span className="h">Coup de main IA</span>
                  <span className="d">
                    {!canAi
                      ? 'Indisponible hors-ligne / sans connexion.'
                      : rem > 0
                        ? 'Colle ou décris — on structure pour toi.'
                        : 'Quota du mois épuisé — la saisie manuelle reste illimitée.'}
                  </span>
                </span>
                {canAi && <span className="cz-quotab">{rem} / 5 ce mois</span>}
              </button>
            </div>
          )}

          {step === 'dup' && <DupPicker onPick={(s) => { setSeed(s); setStep('manual'); }} />}
          {step === 'manual' && <ManualForm seed={seed} onCreated={onCreated} toast={toast} onJson={() => setStep('importjson')} />}
          {step === 'ai' && <AiForm onCreated={onCreated} toast={toast} />}
          {step === 'importjson' && <ImportForm onClose={onClose} toast={toast} />}
        </div>
      </div>
    </>
  );
}

function MacroPreview({ m }: { m: { kcal: number; prot: number; gluc: number; calcium: number } | null }) {
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

/** Porte ① (repli tant que L3-4 absent) : dupliquer une recette existante. */
function DupPicker({ onPick }: { onPick: (seed: ManualSeed) => void }) {
  const recipes = useStore((s) => s.recipes);
  const list = recipes.filter((r) => r.statut !== 'Écarté').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return (
    <div style={{ paddingTop: 6 }}>
      <div className="cz-review" style={{ marginBottom: 10 }}>
        La collection éditoriale arrive bientôt. En attendant, copie une de tes recettes puis adapte-la —
        la copie est à toi, sans relecture.
      </div>
      {list.map((r) => (
        <button
          key={r.id}
          className="cz-librow"
          style={{ marginBottom: 8 }}
          onClick={() =>
            onPick({
              nom: `${r.nom} (copie)`,
              role: r.role,
              ingredients: r.ingredients,
              etapes: r.etapes,
              kcal: r.kcal,
              prot: r.prot,
              gluc: r.gluc,
              lip: r.lip,
              calcium: r.calcium,
              flag_calcium: r.flag_calcium,
            })
          }
        >
          <div className="cz-libtop">
            <span className="nm" style={{ fontWeight: 600, flex: 1 }}>{r.nom}</span>
            <span className="cz-tag role">{ROLE_LABEL[r.role]}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function ManualForm({
  seed,
  onCreated,
  toast,
  onJson,
}: {
  seed: ManualSeed | null;
  onCreated: (id: string) => void;
  toast: (m: string) => void;
  onJson: () => void;
}) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [nom, setNom] = useState(seed?.nom ?? '');
  const [role, setRole] = useState<RecipeRole>(seed?.role ?? 'plat');
  const [ingredients, setIngredients] = useState(seed?.ingredients ?? '');
  const [etapes, setEtapes] = useState(seed?.etapes ?? '');
  const [macros, setMacros] = useState<{ kcal: number; prot: number; gluc: number; lip: number; calcium: number; flag_calcium: CalciumFlag } | null>(
    seed ? { kcal: seed.kcal, prot: seed.prot, gluc: seed.gluc, lip: seed.lip, calcium: seed.calcium, flag_calcium: seed.flag_calcium } : null,
  );
  const [calc, setCalc] = useState(false);

  const compute = async () => {
    if (!ingredients.trim()) return toast('Renseigne d’abord les ingrédients');
    setCalc(true);
    const m = await estimateMacros(ingredients, ROLE_LABEL[role]);
    setMacros(m);
    setCalc(false);
    toast(m.source === 'ia' ? 'Macros estimées' : 'Macros estimées (base locale)');
  };

  const save = async () => {
    if (!nom.trim() || !ingredients.trim()) return;
    let m = macros;
    if (!m) {
      setCalc(true);
      m = await estimateMacros(ingredients, ROLE_LABEL[role]);
      setCalc(false);
    }
    const id = nextRecipeId(recipes, role);
    // Saisie manuelle = recette de l'auteur → naît « Validé » (jamais en relecture).
    upsertRecipe({
      id,
      nom: nom.trim(),
      role,
      statut: 'Validé',
      kcal: m.kcal,
      prot: m.prot,
      gluc: m.gluc,
      lip: m.lip,
      calcium: m.calcium,
      flag_calcium: m.flag_calcium,
      ingredients: ingredients.trim(),
      etapes: etapes.trim() || undefined,
      macros_estimees: true,
    });
    toast('Enregistrée ✓ — c’est la tienne');
    onCreated(id);
  };

  return (
    <div>
      <div className="cz-block" style={{ marginTop: 2 }}>
        <div className="cz-blab">Nom</div>
        <input className="cz-inp" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
      </div>
      <div className="cz-block">
        <div className="cz-blab">Rôle</div>
        <div className="cz-rolepick">
          {ROLES.map((r) => (
            <button key={r} className="cz-rchip" aria-pressed={role === r} onClick={() => setRole(r)}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="cz-block">
        <div className="cz-blab">Ingrédients ({role === 'acc' ? '100 g de référence' : '1 portion'})</div>
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
      </div>
      <button className="cz-cta" onClick={save} disabled={!nom.trim() || !ingredients.trim() || calc}>
        <IconCheck size={17} />
        Enregistrer
      </button>
      <button className="cz-cta ghost" onClick={onJson}>
        Coller du JSON à la place
      </button>
    </div>
  );
}

/** Porte ③ — un seul champ libre : texte collé OU intention. */
function AiForm({ onCreated, toast }: { onCreated: (id: string) => void; toast: (m: string) => void }) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const consumeAi = useStore((s) => s.consumeAi);
  const app = useStore((s) => s.app);
  const rem = remaining(normalizeQuota(app.aiQuota, currentMonth()));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const v = text.trim();
    if (!v) return toast('Colle une recette ou décris ce que tu veux');
    if (rem <= 0) return toast('Quota du mois épuisé — la saisie manuelle reste illimitée');
    setBusy(true);
    try {
      // Texte long / multi-lignes = conversion d'un collé ; court = intention à générer.
      const isPaste = v.length > 100 || v.includes('\n');
      const d = isPaste ? await importRecipeText(v) : await generateRecipeDraft(v);
      const rr = roleFromDraft(d.role);
      const id = nextRecipeId(recipes, rr);
      upsertRecipe({
        id,
        nom: d.nom?.trim() || 'Recette (IA)',
        role: rr,
        statut: 'Test',
        origineIA: true,
        kcal: Math.round(Number(d.kcal) || 0),
        prot: Math.round(Number(d.prot) || 0),
        gluc: Math.round(Number(d.gluc) || 0),
        lip: Math.round(Number(d.lip) || 0),
        calcium: Math.round(Number(d.calcium) || 0),
        flag_calcium: (d.flag_calcium as CalciumFlag) || 'Moyen',
        ingredients: d.ingredients?.trim() || '',
        etapes: d.etapes?.trim() || undefined,
        macros_estimees: true,
        nom_ar: d.nom_ar?.trim() || undefined,
        ingredients_ar: d.ingredients_ar?.trim() || undefined,
        etapes_ar: d.etapes_ar?.trim() || undefined,
      });
      consumeAi(); // décompte seulement en cas de succès
      toast('Brouillon prêt — relis et valide');
      onCreated(id);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="cz-block" style={{ marginTop: 2 }}>
        <div className="cz-blab">Colle une recette, ou décris ce que tu veux</div>
        <textarea
          className="cz-ta"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Ex. « Tajine de poulet léger, citron confit, pour 4 »\n— ou colle la légende d’un post / blog.'}
          autoFocus
        />
      </div>
      <div className="cz-estnote" style={{ marginBottom: 10 }}>{rem} / 5 générations ce mois</div>
      <button className="cz-cta draft" onClick={create} disabled={busy}>
        {busy ? <IconLoader size={18} className="cz-spin" /> : <IconStar size={18} />}
        {busy ? 'On structure…' : 'Créer le brouillon'}
      </button>
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
