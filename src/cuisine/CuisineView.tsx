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
import RadialSheet, { type RadialWay } from './RadialSheet';
import { mealHasAny } from '../lib/menu';
import RecipeDetailSheet from './RecipeDetailSheet';
import AddRecipeSheet from './AddRecipeSheet';
import CollectionsSheet from './CollectionsSheet';
import PartageSheet from './PartageSheet';
import PourQuelRepasSheet from './PourQuelRepasSheet';
import ReglagesSheet from './ReglagesSheet';
import CopyWeekSheet from './CopyWeekSheet';
import { slotForRole, type Creneau } from '../lib/creneaux';
import type { Recipe } from '../types';
import { IconPlus, IconCheck, IconTune } from './icons';
import Em from '../ui/Em';
import './cuisine.css';
import Pastille from '../ui/Pastille';

type Segment = 'semaine' | 'recettes' | 'courses';
type Composer = { dayKey: string; mealKey: MealKey } | null;
type Pick = { dayKey: string; mealKey: MealKey; slot: 'plat' | 'entree' | 'acc'; role: RecipeRole } | null;

// F1.3 (lot Cuisine) : l'onglet s'appelle « Menu » (vocabulaire verrouillé) — la clé
// interne `semaine` ne bouge pas. « Semaines favorites » : REPORTÉ au backlog (PO 14/07).
const SEG_LABEL: Record<Segment, string> = { semaine: 'Menu', recettes: 'Recettes', courses: 'Courses' };
const SEG_EMOJI: Record<Segment, string> = { semaine: '🍽️', recettes: '📖', courses: '🛒' };
const dayNom = (key: string) => SEED_CONFIG.jours.find((j) => j.key === key)?.nom ?? '';

interface Props {
  showAccount: boolean;
  /** T4 : initiale de la pastille de compte (la même aux 4 emplacements). */
  initiale: string;
  onOpenAccount: () => void;
  onBack?: () => void;
  /** Jeton d'un destinataire à cibler à l'ouverture (depuis « Envoyer » de Maison). */
  initialShareToken?: string;
  onConsumeShare?: () => void;
}

/** Rôle du composant principal d'un créneau (petit-déj/goûter = plat seul). */
const soloRole = (k: MealKey): RecipeRole => (k === 'petitdej' ? 'petitdej' : k === 'gouter' ? 'gouter' : 'plat');

export default function CuisineView({ showAccount, initiale, onOpenAccount, onBack, initialShareToken, onConsumeShare }: Props) {
  const recipes = useStore((s) => s.recipes);
  const week = useStore((s) => s.week);
  const setComponent = useStore((s) => s.setComponent);
  const navWeek = useStore((s) => s.navWeek);

  const [seg, setSeg] = useState<Segment>('semaine');
  // F7.2 (DA v2, T2) — le jour SÉLECTIONNÉ dans la bande, DÉFAUT DEMAIN à
  // l'ouverture (le briefing de la cuisinière se prépare la veille) ; le mode
  // Semaine vit sur le bouton dédié. La logique dimanche→lundi est conservée.
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [menuView, setMenuView] = useState<'jour' | 'semaine'>('jour');
  const [selDay, setSelDay] = useState<number>((todayIdx + 1) % 7);
  const weekOffset = useStore((s) => s.weekOffset);
  const regles = useStore((s) => s.regles);
  const [composer, setComposer] = useState<Composer>(null);
  const [pick, setPick] = useState<Pick>(null);
  // T4 (SPEC 5) — le RADIAL : couche d'entrée d'un créneau VIDE. Il précède le
  // composeur sans le contourner (créneau PLEIN → composeur direct, inchangé).
  // `{ create: true }` = mode CRÉATION (FAB Recettes) : mêmes pétales de
  // création, aucun créneau visé — la recette naît dans la bibliothèque.
  const [radial, setRadial] = useState<Composer | { create: true }>(null);
  // Cible posée par un pétale « créer » : la recette créée prend le créneau
  // (même règle que l'amendement ② du sélecteur).
  const [radialTarget, setRadialTarget] = useState<Pick>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ step?: 'ecrire' | 'instructions' } | null>(null);
  const [collections, setCollections] = useState<{ packId?: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | undefined>(undefined);
  // F6.2 : portée initiale du partage (posée par le flux F6.1 ; horizon T7 ensuite).
  // F6.1 (D1) : fiche en cours de « Partager » → feuille « Pour quel repas ? ».
  const [shareFiche, setShareFiche] = useState<Recipe | null>(null);

  const openCollections = (packId?: string) => {
    setAdding(null);
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
  const [reglagesOpen, setReglagesOpen] = useState(false);
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

  // F7.2 — défaut Demain : dimanche soir, « demain » = lundi de la semaine
  // SUIVANTE → recale la semaine chargée à l'ouverture (logique conservée).
  useEffect(() => {
    if (todayIdx === 6 && weekOffset === 0) void navWeek(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pastille « Règles alimentaires » (SPEC 2) : MONTRE les restrictions ;
  // Q7 : aucune règle → état neutre visible (jamais masquée).
  const ruleParts = [regles.halal ? 'halal' : null, ...regles.nePasManger.map((x) => `sans ${x}`)].filter(Boolean);
  const ruleText = ruleParts.length ? ruleParts.join(' · ') : 'Aucune restriction';

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
    setShareToken(undefined);
    setSharing(true);
    toast('Ajoutée au repas — à vous d’envoyer');
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
            Cuisine
          </div>
          <div className="cz-headicons" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {/* T3 (refonte) : la pastille MONTRE le régime réel (jamais de valeur
                en dur — foyer neuf = « Aucune restriction ») et porte désormais
                l'icône de réglages de la maquette : on comprend qu'on peut y
                toucher pour gérer le régime du foyer. */}
            <button className="cz-rulepill" onClick={() => setReglagesOpen(true)} aria-label="Réglages Cuisine">
              <Em ch="🌿" size={12} />
              <span className="txt">{ruleText}</span>
              <span className="tune" aria-hidden>
                <IconTune size={11} />
              </span>
            </button>
            {showAccount && (
              <Pastille initiale={initiale} onClick={onOpenAccount} hostClass="cz-headicon" />
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
            view={menuView}
            dayIdx={selDay}
            onSelectDay={(i) => {
              setSelDay(i);
              setMenuView('jour');
            }}
            onToggleWeek={() => setMenuView((v) => (v === 'jour' ? 'semaine' : 'jour'))}
            onShare={() => {
              setShareToken(undefined);
              setSharing(true);
            }}
            onOpenMeal={(dayKey, mealKey) => {
              // Vide = AUCUN composant (le plat est retirable depuis le retour
              // PO n°3 — une entrée seule reste un repas, donc composeur).
              const meal = week.days[dayKey]?.[mealKey];
              if (mealHasAny(meal)) setComposer({ dayKey, mealKey });
              else setRadial({ dayKey, mealKey });
            }}
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
            onCreate={() => setAdding({})}
            toast={toast}
          />
        ) : (
          <CoursesCuisine toast={toast} />
        )}
      </div>

      {seg === 'recettes' && (
        <button className="cz-fab" aria-label="Ajouter une recette" onClick={() => setRadial({ create: true })}>
          <IconPlus size={24} />
        </button>
      )}

      {radial && (
        <RadialSheet
          mealKey={'create' in radial ? undefined : radial.mealKey}
          dayNom={'create' in radial ? undefined : dayNom(radial.dayKey)}
          libEmpty={recipes.length === 0}
          onWay={(w: RadialWay) => {
            // Mode création (FAB) : pas de créneau → la recette naît en
            // bibliothèque (onCreated ouvre sa fiche, flux existant).
            const target = 'create' in radial
              ? null
              : { dayKey: radial.dayKey, mealKey: radial.mealKey, slot: 'plat' as const, role: soloRole(radial.mealKey) };
            setRadial(null);
            if (w === 'biblio' && target) setPick(target);
            else if (w === 'collection') openCollections();
            else if (w === 'ecrire' || w === 'photo') {
              setRadialTarget(target);
              setAdding({ step: w === 'ecrire' ? 'ecrire' : 'instructions' });
            }
          }}
          onClose={() => setRadial(null)}
        />
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
          onNewRecipe={(step) => setAdding({ step })}
          onCollections={() => openCollections()}
          onClose={() => setPick(null)}
        />
      )}

      {sharing && (
        <PartageSheet
          initialToken={shareToken}
          onClose={() => {
            setSharing(false);
          }}
          toast={toast}
        />
      )}

      {reglagesOpen && <ReglagesSheet onClose={() => setReglagesOpen(false)} />}
      {copyOpen && <CopyWeekSheet onClose={() => setCopyOpen(false)} toast={toast} />}

      {adding && (
        <AddRecipeSheet
          initialRole={(pick ?? radialTarget)?.role}
          initialStep={adding.step}
          onClose={() => {
            setAdding(null);
            setRadialTarget(null);
          }}
          onCreated={(id) => {
            setAdding(null);
            refreshVoice();
            // Amendement ② (sélecteur) — étendu T4 au radial : créée depuis un
            // créneau et du bon rôle → elle le prend directement (geste fini).
            const target = pick ?? radialTarget;
            const created = useStore.getState().recipes.find((r) => r.id === id);
            setRadialTarget(null);
            if (target && created && created.statut === 'Validé' && created.role === target.role) {
              const value: string | AccRef = target.slot === 'acc' ? { id, g: 100 } : id;
              setComponent(target.dayKey, target.mealKey, target.slot, value);
              setPick(null);
              toast('Recette créée et ajoutée au repas');
              return;
            }
            setOpenRecipeId(id);
          }}
          onCollections={() => openCollections()}
          onOpenReglages={() => setReglagesOpen(true)}
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
            <Em ch={SEG_EMOJI[s]} size={22} />
            <span>{SEG_LABEL[s]}</span>
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
