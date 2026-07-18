import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { loadAudioKeys } from '../lib/db';
import type { AccRef, MealKey, RecipeRole } from '../types';
import CoursesCuisine from './CoursesCuisine';
import SemaineView, { type Horizon } from './SemaineView';
import RecettesView from './RecettesView';
import MealComposerSheet from './MealComposerSheet';
import RecipePickerSheet from './RecipePickerSheet';
import RecipeDetailSheet from './RecipeDetailSheet';
import AddRecipeSheet from './AddRecipeSheet';
import CollectionsSheet from './CollectionsSheet';
import PartageSheet from './PartageSheet';
import PourQuelRepasSheet from './PourQuelRepasSheet';
import ReglagesSheet from './ReglagesSheet';
import CopyWeekSheet from './CopyWeekSheet';
import { slotForRole, type Creneau } from '../lib/creneaux';
import type { Recipe } from '../types';
import type { CuisineScope } from '../maison/digest';
import { IconPlus, IconCheck, IconShareUp } from './icons';
import './cuisine.css';

type Segment = 'semaine' | 'recettes' | 'courses';
type Composer = { dayKey: string; mealKey: MealKey } | null;
type Pick = { dayKey: string; mealKey: MealKey; slot: 'plat' | 'entree' | 'acc'; role: RecipeRole } | null;

// F1.3 (lot Cuisine) : l'onglet s'appelle « Menu » (vocabulaire verrouillé) — la clé
// interne `semaine` ne bouge pas. « Semaines favorites » : REPORTÉ au backlog (PO 14/07).
const SEG_LABEL: Record<Segment, string> = { semaine: 'Menu', recettes: 'Recettes', courses: 'Courses' };
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
  const suivi = useStore((s) => s.suivi);
  const setComponent = useStore((s) => s.setComponent);
  const navWeek = useStore((s) => s.navWeek);

  const [seg, setSeg] = useState<Segment>('semaine');
  // F7.2 — horizon du Menu, DÉFAUT DEMAIN à l'ouverture (le briefing de la
  // cuisinière se prépare la veille — même si aujourd'hui est en cours).
  const [horizon, setHorizon] = useState<Horizon>('demain');
  const weekOffset = useStore((s) => s.weekOffset);
  const [composer, setComposer] = useState<Composer>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [collections, setCollections] = useState<{ packId?: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | undefined>(undefined);
  // F6.2 : portée initiale du partage (posée par le flux F6.1 ; horizon T7 ensuite).
  const [shareScope, setShareScope] = useState<{ scope: CuisineScope; dayKey?: string } | null>(null);
  // F6.1 (D1) : fiche en cours de « Partager » → feuille « Pour quel repas ? ».
  const [shareFiche, setShareFiche] = useState<Recipe | null>(null);

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

  // F7.2 — changer d'horizon recale la semaine chargée : les vues jour parlent
  // du VRAI aujourd'hui/demain (dimanche soir : « Demain » = lundi suivant).
  const changeHorizon = (h: Horizon) => {
    setHorizon(h);
    if (h === 'aujourdhui' && weekOffset !== 0) void navWeek(-weekOffset);
    if (h === 'demain') {
      const target = (new Date().getDay() + 6) % 7 === 6 ? 1 : 0;
      if (weekOffset !== target) void navWeek(target - weekOffset);
    }
  };

  // F6.1 (D1) — Partager depuis la fiche : ajout au menu PUIS partage, jamais
  // un second canal. Moments sans créneau (Q2) : le geste explique, sans détour.
  const shareFromFiche = (r: Recipe) => {
    if (!slotForRole(r.role)) {
      toast('Ce moment n’a pas de créneau au menu pour l’instant — le partage passe par les repas');
      return;
    }
    setShareFiche(r);
  };

  const placeAndShare = async (r: Recipe, c: Creneau) => {
    if (c.weekDelta === 1) await navWeek(1); // dimanche soir → lundi suivant
    const value: string | AccRef = c.slot === 'acc' ? { id: r.id, g: 100 } : r.id;
    setComponent(c.dayKey, c.mealKey, c.slot, value);
    setShareFiche(null);
    setOpenRecipeId(null);
    // F6.2 : la portée du MESSAGE suit le créneau — la page reste complète.
    const scope: CuisineScope = c.dOffset === 0 ? 'aujourdhui' : c.dOffset === 1 ? 'demain' : 'jour';
    setShareScope({ scope, dayKey: c.dayKey });
    setShareToken(undefined);
    setSharing(true);
    toast('Ajoutée au repas — à toi d’envoyer');
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
            {/* F2.2 #5 : la pastille Objectif n'existe que si le suivi est ON ;
                la feuille Réglages (⚙), elle, reste toujours accessible. */}
            {suivi && (
              <button className="cz-pill" onClick={() => setObjectiveOpen(true)}>
                Objectif {objective.toLocaleString('fr-FR')} kcal/pers.
              </button>
            )}
            <button
              className="cz-headicon"
              style={{ marginLeft: 8 }}
              onClick={() => setObjectiveOpen(true)}
              aria-label="Réglages Cuisine"
            >
              ⚙
            </button>
            <button
              className="cz-headicon"
              onClick={() => {
                setShareToken(undefined);
                // F6.2 branché sur l'horizon (T7) : la portée du digest suit la vue.
                setShareScope(seg === 'semaine' ? { scope: horizon } : null);
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
      </header>
      {/* F7.2 — la navigation vit au FOOTER (une seule barre, fond blanc,
          bordure + ombre, actif = pastille foncée). L'en-tête n'a plus d'onglets. */}

      <div className="cz-content">
        {seg === 'semaine' ? (
          <SemaineView
            voiceIds={voiceIds}
            horizon={horizon}
            onHorizon={changeHorizon}
            onOpenMeal={(dayKey, mealKey) => setComposer({ dayKey, mealKey })}
            onCopyWeek={() => setCopyOpen(true)}
            onGoValidate={() => {
              setRecFilters('draft');
              switchSeg('recettes');
            }}
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
          onNewRecipe={() => setAdding(true)}
          onClose={() => setPick(null)}
        />
      )}

      {sharing && (
        <PartageSheet
          initialToken={shareToken}
          initialScope={shareScope?.scope}
          initialDayKey={shareScope?.dayKey}
          onClose={() => {
            setSharing(false);
            setShareScope(null);
          }}
          toast={toast}
        />
      )}

      {objectiveOpen && <ReglagesSheet onClose={() => setObjectiveOpen(false)} />}
      {copyOpen && <CopyWeekSheet onClose={() => setCopyOpen(false)} toast={toast} />}

      {adding && (
        <AddRecipeSheet
          initialRole={pick?.role}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            refreshVoice();
            // Amendement ② : créée depuis le sélecteur de composant et du bon
            // rôle → elle prend directement le créneau (le geste se termine).
            const created = useStore.getState().recipes.find((r) => r.id === id);
            if (pick && created && created.statut === 'Validé' && created.role === pick.role) {
              const value: string | AccRef = pick.slot === 'acc' ? { id, g: 100 } : id;
              setComponent(pick.dayKey, pick.mealKey, pick.slot, value);
              setPick(null);
              toast('Recette créée et ajoutée au repas');
              return;
            }
            setOpenRecipeId(id);
          }}
          onCollections={() => openCollections()}
          onOpenReglages={() => setObjectiveOpen(true)}
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
          onOpenRecipe={(id) => setOpenRecipeId(id)}
          onShare={shareFromFiche}
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

      {/* F6.1 — rendue APRÈS la fiche : elle s'empile AU-DESSUS (ordre DOM = ordre
          de peinture à z-index égal — leçon attrapée par la porte smoke). */}
      {shareFiche && (
        <PourQuelRepasSheet
          recipe={shareFiche}
          onPick={(c) => void placeAndShare(shareFiche, c)}
          onClose={() => setShareFiche(null)}
        />
      )}

      {/* F7.2 — LA barre (unique) : Menu · Recettes · Courses, actif = pastille foncée. */}
      <nav className="cz-footbar" role="tablist" aria-label="Navigation Cuisine">
        {(['semaine', 'recettes', 'courses'] as Segment[]).map((s) => (
          <button key={s} className="cz-fbtn" role="tab" aria-selected={seg === s} onClick={() => switchSeg(s)}>
            {SEG_LABEL[s]}
          </button>
        ))}
      </nav>

      <div className={'cz-toast' + (toastMsg ? ' show' : '')}>
        {toastMsg && <IconCheck size={16} />}
        {toastMsg}
      </div>
    </div>
  );
}
