import { useEffect, useMemo, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { estimateMacros } from '../lib/ai';
import { nextRecipeId } from '../lib/recipeId';
import { splitIngredients, splitSteps } from '../lib/ingredients';
import { cleanText, cleanQty } from '../lib/sanitize';
import { ROLE_LABEL, type CalciumFlag, type Recipe, type RecipeRole } from '../types';
import ConsigneVocale from './ConsigneVocale';
import FichePhoto from './FichePhoto';
import {
  IconStar,
  IconCheck,
  IconClock,
  IconShareUp,
  IconLoader,
  IconFav,
} from './icons';

const flagClass = (f: CalciumFlag) => (f === 'Champion' ? 'champion' : f === 'Moyen' ? 'moyen' : 'faible');
// F5.2 : les 8 moments, aussi à l'édition.
const ROLES: RecipeRole[] = ['petitdej', 'entree', 'plat', 'acc', 'dessert', 'soupe', 'gouter', 'boisson'];

interface Props {
  recipeId: string;
  voiceIds: Set<string>;
  onClose: () => void;
  onVoiceChange: (id: string, has: boolean) => void;
  /** F5.4 (⋯ Dupliquer) : ouvre la fiche de la copie créée. */
  onOpenRecipe?: (id: string) => void;
  /** F6.1 (D1) : Partager = ajouter au menu puis partager — orchestré par CuisineView. */
  onShare?: (r: Recipe) => void;
  toast: (m: string) => void;
}

export default function RecipeDetailSheet({ recipeId, voiceIds, onClose, onVoiceChange, onOpenRecipe, onShare, toast }: Props) {
  const recipe = useStore((s) => s.recipes.find((r) => r.id === recipeId));
  const recipes = useStore((s) => s.recipes);
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

  // F5.4 (⋯ → Dupliquer) : copie par SPREAD — le statut est hérité (Validé),
  // jamais écrit en littéral ici (le verrou statique relecture-lock y veille).
  const duplicate = () => {
    const id = nextRecipeId(recipes, recipe.role);
    upsertRecipe({ ...recipe, id, nom: `${recipe.nom} (copie)`, fav: false, packId: undefined });
    toast('Copie créée — à toi de l’adapter');
    onOpenRecipe?.(id);
  };

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
            onDuplicate={duplicate}
            onShare={() => onShare?.(recipe)}
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
            toast={toast}
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
  onDuplicate,
  onShare,
  onValidate,
  onDiscard,
  onVoiceChange,
  suivi,
  toast,
}: {
  suivi: boolean;
  recipe: Recipe;
  draft: boolean;
  hasVoice: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onValidate: () => void;
  onDiscard: () => void;
  onVoiceChange: (has: boolean) => void;
  toast: (m: string) => void;
}) {
  const ings = useMemo(() => splitIngredients(recipe.ingredients), [recipe.ingredients]);
  const steps = useMemo(() => splitSteps(recipe.etapes), [recipe.etapes]);
  const estimated = draft || recipe.macros_estimees;
  const [menuOpen, setMenuOpen] = useState(false);

  // F5.2 — pastilles : moment · cuisine · ◆ difficulté · temps · X pers.
  // (omises quand absentes — cas limite du brief).
  const pastilles = [
    ROLE_LABEL[recipe.role],
    recipe.cuisine,
    recipe.difficulte ? `◆ ${recipe.difficulte}` : null,
    recipe.temps,
    recipe.portions ? `${recipe.portions} pers.` : null,
  ].filter((x): x is string => !!x);

  return (
    <>
      {/* F5.4 — barre du haut : ‹ retour · ♡ discret · ⋯ · Partager DOMINANT.
          Le titre vit SOUS la barre (jamais de chevauchement, à toutes largeurs).
          Sur un brouillon : pas de Partager (T6 définira le partage d'un brouillon
          sans créer de chemin de traverse — trace PO). */}
      <div className="cz-fichebar">
        <button className="cz-back" onClick={onClose} aria-label="Fermer">
          ‹
        </button>
        <span style={{ flex: 1 }} />
        <FavStar id={recipe.id} fav={recipe.fav} />
        <div className="cz-menuwrap">
          <button className="cz-headicon" aria-label="Plus d’actions" onClick={() => setMenuOpen((v) => !v)}>
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="cz-menuveil" onClick={() => setMenuOpen(false)} />
              <div className="cz-menu" role="menu">
                <button role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}>
                  Modifier
                </button>
                {!draft && (
                  <button role="menuitem" onClick={() => { setMenuOpen(false); onDuplicate(); }}>
                    Dupliquer
                  </button>
                )}
                <button role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDiscard(); }}>
                  Écarter
                </button>
              </div>
            </>
          )}
        </div>
        {!draft && (
          <button className="cz-sharebtn" onClick={onShare}>
            <IconShareUp size={15} />
            Partager
          </button>
        )}
      </div>

      <div className="cz-sheetbody">
        {/* F5.3 — bandeau photo du plat (≠ « en photo » de l'import F4.3). */}
        <FichePhoto recipeId={recipe.id} toast={toast} />
        {/* F5.1 — ordre : titre (Fraunces) · tags · voix · ingrédients · étapes ;
            les chiffres (macros) APRÈS tout, et seulement si suivi ON. */}
        <h2 className="cz-fichetitle clamp2">{cleanText(recipe.nom)}</h2>
        <div className="cz-fichetags">
          {pastilles.map((p, i) => (
            <span className="cz-tag role" key={i}>
              {p}
            </span>
          ))}
          {draft ? <span className="cz-tag draft">✦ À valider</span> : <span className="cz-tag ok">Validé</span>}
          {suivi && (
            <span className={'cz-caflag ' + flagClass(recipe.flag_calcium)} style={{ fontSize: 11.5 }}>
              ◆ {recipe.flag_calcium.toLowerCase()}
            </span>
          )}
        </div>

        {draft && (
          <div className="cz-aibanner">
            <IconStar size={17} />
            <span>
              Recette <b>à valider</b>. {suivi ? 'Macros estimées automatiquement. ' : ''}Ajuste-la,
              puis valide pour l’ajouter à ta bibliothèque.
            </span>
          </div>
        )}
        {/* G3 (F4.4, libellé corrigé retour Q&A) : adapteSelon trace la DEMANDE faite
            au modèle, pas un fait accompli — le bandeau invite à vérifier, n'affirme pas. */}
        {draft && recipe.adapteSelon && recipe.adapteSelon.length > 0 && (
          <div className="cz-estnote">
            <IconClock size={13} />
            On a demandé d’adapter selon : {recipe.adapteSelon.join(' · ')} — vérifie que c’est bien
            le cas.
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

        {/* F5.1 cas limite : recette sans étapes → section OMISE proprement
            (sur un brouillon on garde l'invite — la relecture doit la compléter). */}
        {(steps.length > 0 || draft) && (
          <>
            <div className="cz-sect">Préparation</div>
            {steps.length > 0 ? (
              <div className="cz-steps">
                {steps.map((s, i) => (
                  <div className="cz-step" key={i}>
                    <span className="cz-stepnum">{i + 1}</span>
                    <div className="stx">{s}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="cz-emptynote">Aucune étape renseignée (modifie la recette pour en ajouter).</p>
            )}
          </>
        )}

        {/* Tuiles macros : conditionnées T2, CONDAMNÉES par la décision PO « la
            nutrition sort du produit » — fonctionnelles sous le flag, zéro polish. */}
        {suivi && estimated && (
          <div className="cz-estnote">
            <IconClock size={13} />
            Macros estimées · à valider
          </div>
        )}
        {suivi && (
          <div className="cz-dmacros">
            <Cell v={recipe.kcal} l={recipe.role === 'acc' ? 'kcal/100g' : 'kcal'} />
            <Cell v={recipe.prot} l="prot" />
            <Cell v={recipe.gluc} l="gluc" />
            <Cell v={recipe.calcium} l="calcium" ca />
          </div>
        )}

        {draft && (
          <>
            <button className="cz-cta draft" onClick={onValidate}>
              <IconCheck size={17} />
              Valider et ajouter à la bibliothèque
            </button>
            <button className="cz-cta ghost" onClick={onEdit}>
              Modifier d’abord
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
  // F5.2 — tags optionnels, éditables ici (pastilles omises si vides).
  const [portions, setPortions] = useState(recipe.portions ?? 4);
  const [cuisine, setCuisine] = useState(recipe.cuisine ?? '');
  const [difficulte, setDifficulte] = useState(recipe.difficulte ?? '');
  const [temps, setTemps] = useState(recipe.temps ?? '');
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
    toast('Macros estimées');
  };

  const save = (validate: boolean) => {
    const next: Recipe = {
      ...recipe,
      nom: nom.trim() || recipe.nom,
      role,
      portions,
      cuisine: cuisine.trim() || undefined,
      difficulte: difficulte || undefined,
      temps: temps.trim() || undefined,
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
          <div className="cz-blab">Moment</div>
          <div className="cz-rolepick">
            {ROLES.map((r) => (
              <button key={r} className="cz-rchip" aria-pressed={role === r} onClick={() => setRole(r)}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        {/* F5.2 — tags optionnels (cuisine · difficulté · temps · portions). */}
        <div className="cz-block">
          <div className="cz-blab">Cuisine (optionnel)</div>
          <input className="cz-inp" value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Marocain, Italien…" />
        </div>
        <div className="cz-block">
          <div className="cz-blab">Difficulté (optionnel)</div>
          <div className="cz-rolepick">
            {['Facile', 'Moyen', 'Difficile'].map((d) => (
              <button
                key={d}
                className="cz-rchip"
                aria-pressed={difficulte === d}
                onClick={() => setDifficulte(difficulte === d ? '' : d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="cz-block">
          <div className="cz-blab">Temps (optionnel)</div>
          <input className="cz-inp" value={temps} onChange={(e) => setTemps(e.target.value)} placeholder="1 h, 40 min…" />
        </div>
        <div className="cz-block">
          <div className="cz-blab">Portions</div>
          <div className="cz-objset">
            <button onClick={() => setPortions(Math.max(1, portions - 1))} aria-label="Moins">
              −
            </button>
            <div className="cz-objval">
              <span>{portions}</span>
              <small>portion{portions > 1 ? 's' : ''}</small>
            </div>
            <button onClick={() => setPortions(Math.min(12, portions + 1))} aria-label="Plus">
              +
            </button>
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
