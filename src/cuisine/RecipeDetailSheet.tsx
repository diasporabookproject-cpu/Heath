import { useEffect, useMemo, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { estimateMacros } from '../lib/ai';
import { splitIngredients, splitSteps } from '../lib/ingredients';
import { cleanText, cleanQty } from '../lib/sanitize';
import { ROLE_LABEL, type CalciumFlag, type Recipe, type RecipeRole } from '../types';
import ConsigneVocale from './ConsigneVocale';
import {
  IconStar,
  IconCheck,
  IconClock,
  IconShareUp,
  IconLoader,
  IconFav,
} from './icons';

const flagClass = (f: CalciumFlag) => (f === 'Champion' ? 'champion' : f === 'Moyen' ? 'moyen' : 'faible');
const ROLES: RecipeRole[] = ['petitdej', 'entree', 'plat', 'acc'];

interface Props {
  recipeId: string;
  voiceIds: Set<string>;
  onClose: () => void;
  onVoiceChange: (id: string, has: boolean) => void;
  toast: (m: string) => void;
}

export default function RecipeDetailSheet({ recipeId, voiceIds, onClose, onVoiceChange, toast }: Props) {
  const recipe = useStore((s) => s.recipes.find((r) => r.id === recipeId));
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const validateRecipe = useStore((s) => s.validateRecipe);
  const setStatut = useStore((s) => s.setStatut);
  const suivi = useStore((s) => s.suivi); // F2.2 #4 : fiche + édition sous le flag

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (!recipe) return null;
  const draft = recipe.statut === 'Test';

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        {mode === 'view' ? (
          <DetailBody
            recipe={recipe}
            draft={draft}
            suivi={suivi}
            hasVoice={voiceIds.has(recipe.id)}
            onClose={onClose}
            onEdit={() => setMode('edit')}
            onValidate={() => {
              validateRecipe(recipe.id);
              toast('Recette validée et ajoutée à la bibliothèque');
            }}
            onDiscard={() => {
              setStatut(recipe.id, 'Écarté');
              toast('Recette écartée');
              onClose();
            }}
            onVoiceChange={(has) => onVoiceChange(recipe.id, has)}
          />
        ) : (
          <EditBody
            recipe={recipe}
            suivi={suivi}
            onCancel={() => setMode('view')}
            onSave={(next, validate) => {
              upsertRecipe(next);
              if (validate) validateRecipe(next.id);
              toast(validate ? 'Recette enregistrée et validée' : 'Recette enregistrée');
              setMode('view');
            }}
            onVoiceChange={(has) => onVoiceChange(recipe.id, has)}
            toast={toast}
          />
        )}
      </div>
    </>
  );
}

function DetailBody({
  recipe,
  draft,
  onClose,
  onEdit,
  onValidate,
  onDiscard,
  onVoiceChange,
  suivi,
}: {
  suivi: boolean;
  recipe: Recipe;
  draft: boolean;
  hasVoice: boolean;
  onClose: () => void;
  onEdit: () => void;
  onValidate: () => void;
  onDiscard: () => void;
  onVoiceChange: (has: boolean) => void;
}) {
  const ings = useMemo(() => splitIngredients(recipe.ingredients), [recipe.ingredients]);
  const steps = useMemo(() => splitSteps(recipe.etapes), [recipe.etapes]);
  const estimated = draft || recipe.macros_estimees;

  return (
    <>
      <div className="cz-sheethead">
        <div className="ttl">
          <span className="clamp2">{cleanText(recipe.nom)}</span>
          <small>{ROLE_LABEL[recipe.role]} · 100 % sans gluten</small>
        </div>
        <button className="cz-x" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>
      <div className="cz-sheetbody">
        {draft && (
          <div className="cz-aibanner">
            <IconStar size={17} />
            <span>
              Recette <b>à valider</b>. {suivi ? 'Macros estimées automatiquement. ' : ''}Ajuste-la,
              puis valide pour l’ajouter à ta bibliothèque.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
          <FavStar id={recipe.id} fav={recipe.fav} />
          <span className="cz-tag role">{ROLE_LABEL[recipe.role]}</span>
          {/* F2.2 : le repère calcium suit le flag comme le reste de la nutrition
              (décision lot Cuisine — l'invariant « calcium visible » vaut suivi ON). */}
          {suivi && (
            <span className={'cz-caflag ' + flagClass(recipe.flag_calcium)} style={{ fontSize: 11.5 }}>
              ◆ {recipe.flag_calcium.toLowerCase()}
            </span>
          )}
          {draft ? <span className="cz-tag draft">✦ À valider</span> : <span className="cz-tag ok">Validé</span>}
        </div>

        {suivi && estimated && (
          <div className="cz-estnote">
            <IconClock size={13} />
            Macros estimées · à valider
          </div>
        )}

        {/* F2.2 #4 : tuiles macros de la fiche sous le flag. */}
        {suivi && (
          <div className="cz-dmacros">
            <Cell v={recipe.kcal} l={recipe.role === 'acc' ? 'kcal/100g' : 'kcal'} />
            <Cell v={recipe.prot} l="prot" />
            <Cell v={recipe.gluc} l="gluc" />
            <Cell v={recipe.calcium} l="calcium" ca />
          </div>
        )}

        <div className="cz-sect">
          Consigne vocale pour la cuisinière
          <span className="cz-badge-share">
            <IconShareUp size={11} />
            partagée
          </span>
        </div>
        <ConsigneVocale recipeId={recipe.id} onChange={onVoiceChange} />

        <div className="cz-sect">Ingrédients · {recipe.role === 'acc' ? '100 g de référence' : 'une portion'}</div>
        {ings.length > 0 ? (
          <div className="cz-inglist">
            {ings.map((it, i) => (
              <div className="cz-ingrow" key={i}>
                <span>{cleanText(it.name)}</span>
                {it.qty && <span className="q">{cleanQty(it.qty)}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="cz-emptynote">Aucun ingrédient renseigné.</p>
        )}

        <div className="cz-sect">Préparation</div>
        {steps.length > 0 ? (
          <div className="cz-steps">
            {steps.map((s, i) => (
              <div className="cz-step" key={i}>
                <div className="stx">{s}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="cz-emptynote">Aucune étape renseignée (modifie la recette pour en ajouter).</p>
        )}

        {draft ? (
          <>
            <button className="cz-cta draft" onClick={onValidate}>
              <IconCheck size={17} />
              Valider et ajouter à la bibliothèque
            </button>
            <button className="cz-cta ghost" onClick={onEdit}>
              Modifier d’abord
            </button>
          </>
        ) : (
          <>
            <button className="cz-cta" onClick={onEdit}>
              Modifier la recette
            </button>
            <button className="cz-cta ghost" onClick={onDiscard}>
              Écarter
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Cell({ v, l, ca }: { v: number; l: string; ca?: boolean }) {
  return (
    <div className={'cz-dmcell' + (ca ? ' ca' : '')}>
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function FavStar({ id, fav }: { id: string; fav?: boolean }) {
  const toggleFav = useStore((s) => s.toggleFav);
  return (
    <span
      className={'cz-starbtn' + (fav ? ' on' : '')}
      role="button"
      tabIndex={0}
      aria-label="Favori"
      onClick={() => toggleFav(id)}
    >
      <IconFav size={16} filled={fav} />
    </span>
  );
}

function EditBody({
  recipe,
  suivi,
  onCancel,
  onSave,
  onVoiceChange,
  toast,
}: {
  recipe: Recipe;
  suivi: boolean;
  onCancel: () => void;
  onSave: (next: Recipe, validate: boolean) => void;
  onVoiceChange: (has: boolean) => void;
  toast: (m: string) => void;
}) {
  const [nom, setNom] = useState(recipe.nom);
  const [role, setRole] = useState<RecipeRole>(recipe.role);
  const [ingredients, setIngredients] = useState(recipe.ingredients);
  const [etapes, setEtapes] = useState(recipe.etapes ?? '');
  const [nomAr, setNomAr] = useState(recipe.nom_ar ?? '');
  const [ingAr, setIngAr] = useState(recipe.ingredients_ar ?? '');
  const [etapesAr, setEtapesAr] = useState(recipe.etapes_ar ?? '');
  const [macros, setMacros] = useState({
    kcal: recipe.kcal,
    prot: recipe.prot,
    gluc: recipe.gluc,
    lip: recipe.lip,
    calcium: recipe.calcium,
    flag_calcium: recipe.flag_calcium,
  });
  const [estimated, setEstimated] = useState(!!recipe.macros_estimees || recipe.statut === 'Test');
  const [calc, setCalc] = useState(false);
  const wasDraft = recipe.statut === 'Test';

  const recompute = async () => {
    if (!ingredients.trim()) {
      toast('Renseigne d’abord les ingrédients');
      return;
    }
    setCalc(true);
    const m = await estimateMacros(ingredients, ROLE_LABEL[role]);
    setMacros({ kcal: m.kcal, prot: m.prot, gluc: m.gluc, lip: m.lip, calcium: m.calcium, flag_calcium: m.flag_calcium });
    setEstimated(true);
    setCalc(false);
    toast(m.source === 'ia' ? 'Macros estimées par l’IA' : 'Macros estimées (base locale)');
  };

  const save = (validate: boolean) => {
    const next: Recipe = {
      ...recipe,
      nom: nom.trim() || recipe.nom,
      role,
      ingredients: ingredients.trim(),
      etapes: etapes.trim() || undefined,
      kcal: macros.kcal,
      prot: macros.prot,
      gluc: macros.gluc,
      lip: macros.lip,
      calcium: macros.calcium,
      flag_calcium: macros.flag_calcium,
      macros_estimees: validate ? false : estimated,
      nom_ar: nomAr.trim() || undefined,
      ingredients_ar: ingAr.trim() || undefined,
      etapes_ar: etapesAr.trim() || undefined,
    };
    onSave(next, validate);
  };

  return (
    <>
      <div className="cz-sheethead">
        <div className="ttl">
          Modifier la recette
          <small>{suivi ? 'Ajuste, recalcule les macros, enregistre' : 'Ajuste et enregistre'}</small>
        </div>
        <button className="cz-x" onClick={onCancel} aria-label="Annuler">
          ✕
        </button>
      </div>
      <div className="cz-sheetbody">
        <div className="cz-block" style={{ marginTop: 2 }}>
          <div className="cz-blab">Nom</div>
          <input className="cz-inp" value={nom} onChange={(e) => setNom(e.target.value)} />
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
          <div className="cz-blab">Ingrédients pesés ({role === 'acc' ? '100 g de référence' : '1 portion'})</div>
          <textarea
            className="cz-ta"
            rows={5}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
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
            placeholder={'Préchauffer le four à 200 °C.\nDisposer sur une plaque.\nEnfourner 15 min.'}
          />
        </div>

        {/* F2.2 #2/#3 : le bloc Macros (aperçu + recalcul) n'apparaît que si le suivi
            est ON — les valeurs, elles, restent portées et sauvegardées à l'identique. */}
        {suivi && (
          <div className="cz-block">
            <div className="cz-blab">Macros</div>
            <div className="cz-estnote">
              <IconClock size={13} />
              {estimated ? 'Estimées automatiquement · recalcule après tes modifs' : 'Vérifiées'}
            </div>
            <div className="cz-dmacros">
              <Cell v={macros.kcal} l="kcal" />
              <Cell v={macros.prot} l="prot" />
              <Cell v={macros.gluc} l="gluc" />
              <Cell v={macros.calcium} l="calcium" ca />
            </div>
            <button className="cz-calcbtn" style={{ marginTop: 9 }} onClick={recompute} disabled={calc}>
              {calc ? <IconLoader size={16} className="cz-spin" /> : <IconStar size={16} />}
              {calc ? 'Calcul…' : 'Recalculer les macros à partir des ingrédients'}
            </button>
          </div>
        )}

        <div className="cz-block">
          <div className="cz-blab">Consigne vocale</div>
          <ConsigneVocale recipeId={recipe.id} onChange={onVoiceChange} />
        </div>

        <div className="cz-block">
          <div className="cz-blab">الاسم بالدارجة (اختياري)</div>
          <input className="cz-inp" dir="rtl" value={nomAr} onChange={(e) => setNomAr(e.target.value)} />
        </div>
        <div className="cz-block">
          <div className="cz-blab">المكونات بالدارجة (اختياري)</div>
          <textarea className="cz-ta" dir="rtl" rows={4} value={ingAr} onChange={(e) => setIngAr(e.target.value)} />
        </div>
        <div className="cz-block">
          <div className="cz-blab">طريقة التحضير بالدارجة (اختياري)</div>
          <textarea className="cz-ta" dir="rtl" rows={4} value={etapesAr} onChange={(e) => setEtapesAr(e.target.value)} />
        </div>

        <button className="cz-cta" onClick={() => save(wasDraft)}>
          {wasDraft ? 'Enregistrer et valider' : 'Enregistrer'}
        </button>
        <button className="cz-cta ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </>
  );
}
