import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { loadAudioKeys } from '../lib/db';
import type { AccRef, MealKey, RecipeRole } from '../types';
import CoursesCuisine from './CoursesCuisine';
import SemaineView from './SemaineView';
import RecettesView from './RecettesView';
import MealComposerSheet from './MealComposerSheet';
import RecipePickerSheet from './RecipePickerSheet';
import RecipeDetailSheet from './RecipeDetailSheet';
import AddRecipeSheet from './AddRecipeSheet';
import CollectionsSheet from './CollectionsSheet';
import PartageSheet from './PartageSheet';
import ObjectiveSheet from './ObjectiveSheet';
import CopyWeekSheet from './CopyWeekSheet';
import { IconPlus, IconCheck, IconShareUp } from './icons';
import './cuisine.css';

type Segment = 'semaine' | 'recettes' | 'courses';
type Composer = { dayKey: string; mealKey: MealKey } | null;
type Pick = { dayKey: string; mealKey: MealKey; slot: 'plat' | 'entree' | 'acc'; role: RecipeRole } | null;

const SEG_LABEL: Record<Segment, string> = { semaine: 'Semaine', recettes: 'Recettes', courses: 'Courses' };
const dayNom = (key: string) => SEED_CONFIG.jours.find((j) => j.key === key)?.nom ?? '';

interface Props {
  showAccount: boolean;
  connected: boolean;
  onOpenAccount: () => void;
  onBack?: () => void;
  /** Jeton d'un destinataire à cibler à l'ouverture (depuis « Envoyer » de Maison). */
  initialShareToken?: string;
  onConsumeShare?: () => void;
}

export default function CuisineView({ showAccount, connected, onOpenAccount, onBack, initialShareToken, onConsumeShare }: Props) {
  const recipes = useStore((s) => s.recipes);
  const objective = useStore((s) => s.settings.objective);
  const setComponent = useStore((s) => s.setComponent);

  const [seg, setSeg] = useState<Segment>('semaine');
  const [composer, setComposer] = useState<Composer>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [collections, setCollections] = useState<{ packId?: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | undefined>(undefined);

  const openCollections = (packId?: string) => {
    setAdding(false);
    setCollections({ packId });
  };

  // Ouverture ciblée depuis Maison (« Envoyer ») : ouvre la feuille de partage
  // pré-sélectionnée sur le destinataire, puis consomme le jeton (une seule fois).
  useEffect(() => {
    if (initialShareToken) {
      setShareToken(initialShareToken);
      setSharing(true);
      onConsumeShare?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShareToken]);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [recFilters, setRecFilters] = useState<string>('all');
  const [voiceIds, setVoiceIds] = useState<Set<string>>(new Set());

  const [toastMsg, setToastMsg] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = (msg: string) => {
    setToastMsg(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(''), 2200);
  };

  const refreshVoice = () => void loadAudioKeys().then((keys) => setVoiceIds(new Set(keys)));
  useEffect(() => {
    refreshVoice();
  }, [recipes]);

  const switchSeg = (s: Segment) => {
    setSeg(s);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="cz">
      <header className="cz-head">
        <div className="cz-brandrow">
          <div className="cz-brand">
            {onBack && (
              <button className="cz-back" onClick={onBack} aria-label="Retour à Maison">
                ‹
              </button>
            )}
            <span className="cz-mark" />
            Cuisine
          </div>
          <div className="cz-headicons">
            <button className="cz-pill" onClick={() => setObjectiveOpen(true)}>
              Objectif {objective.toLocaleString('fr-FR')} kcal/pers.
            </button>
            <button
              className="cz-headicon"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setShareToken(undefined);
                setSharing(true);
              }}
              aria-label="Partager le menu"
            >
              <IconShareUp size={18} />
            </button>
            {showAccount && (
              <button
                className="cz-headicon"
                onClick={onOpenAccount}
                aria-label="Compte et synchro"
                title={connected ? 'Connecté' : 'Se connecter'}
              >
                ☁︎
              </button>
            )}
          </div>
        </div>
        <div className="cz-segmented" role="tablist">
          {(['semaine', 'recettes', 'courses'] as Segment[]).map((s) => (
            <button key={s} className="cz-seg" role="tab" aria-selected={seg === s} onClick={() => switchSeg(s)}>
              {SEG_LABEL[s]}
            </button>
          ))}
        </div>
      </header>

      <div className="cz-content">
        {seg === 'semaine' ? (
          <SemaineView
            voiceIds={voiceIds}
            onOpenMeal={(dayKey, mealKey) => setComposer({ dayKey, mealKey })}
            onCopyWeek={() => setCopyOpen(true)}
            onGoValidate={() => {
              setRecFilters('draft');
              switchSeg('recettes');
            }}
            onOpenCollections={openCollections}
            toast={toast}
          />
        ) : seg === 'recettes' ? (
          <RecettesView
            voiceIds={voiceIds}
            filter={recFilters}
            setFilter={setRecFilters}
            onOpenRecipe={(id) => setOpenRecipeId(id)}
            onOpenCollections={openCollections}
            toast={toast}
          />
        ) : (
          <CoursesCuisine toast={toast} />
        )}
      </div>

      {seg === 'recettes' && (
        <button className="cz-fab" aria-label="Ajouter une recette" onClick={() => setAdding(true)}>
          <IconPlus size={24} />
        </button>
      )}

      {composer && (
        <MealComposerSheet
          dayKey={composer.dayKey}
          dayNom={dayNom(composer.dayKey)}
          mealKey={composer.mealKey}
          onPickSlot={(slot, role) =>
            setPick({ dayKey: composer.dayKey, mealKey: composer.mealKey, slot, role })
          }
          onClose={() => setComposer(null)}
        />
      )}

      {pick && (
        <RecipePickerSheet
          role={pick.role}
          sub={`${dayNom(pick.dayKey)}`}
          voiceIds={voiceIds}
          onPick={(id) => {
            const value: string | AccRef = pick.slot === 'acc' ? { id, g: 100 } : id;
            setComponent(pick.dayKey, pick.mealKey, pick.slot, value);
            setPick(null);
            toast('Composant ajouté');
          }}
          onClose={() => setPick(null)}
        />
      )}

      {sharing && (
        <PartageSheet
          initialToken={shareToken}
          onClose={() => setSharing(false)}
          toast={toast}
        />
      )}
      {objectiveOpen && <ObjectiveSheet onClose={() => setObjectiveOpen(false)} />}
      {copyOpen && <CopyWeekSheet onClose={() => setCopyOpen(false)} toast={toast} />}

      {adding && (
        <AddRecipeSheet
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            refreshVoice();
            setOpenRecipeId(id);
          }}
          onCollections={() => openCollections()}
          toast={toast}
        />
      )}

      {collections && (
        <CollectionsSheet
          initialPackId={collections.packId}
          onClose={() => setCollections(null)}
          toast={toast}
        />
      )}

      {openRecipeId && (
        <RecipeDetailSheet
          recipeId={openRecipeId}
          voiceIds={voiceIds}
          onClose={() => setOpenRecipeId(null)}
          onVoiceChange={(id, has) =>
            setVoiceIds((prev) => {
              const n = new Set(prev);
              if (has) n.add(id);
              else n.delete(id);
              return n;
            })
          }
          toast={toast}
        />
      )}

      <div className={'cz-toast' + (toastMsg ? ' show' : '')}>
        {toastMsg && <IconCheck size={16} />}
        {toastMsg}
      </div>
    </div>
  );
}
