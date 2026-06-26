import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { SEED_CONFIG } from '../data';
import { loadAudioKeys } from '../lib/db';
import BibliothequeView from '../views/BibliothequeView';
import CoursesView from '../views/CoursesView';
import SemaineView from './SemaineView';
import RecipePickerSheet from './RecipePickerSheet';
import { IconPlus, IconCheck } from './icons';
import './cuisine.css';

type Segment = 'semaine' | 'recettes' | 'courses';
type PickTarget = { dayKey: string; slot: 'dej' | 'din' } | null;

const SEG_LABEL: Record<Segment, string> = {
  semaine: 'Semaine',
  recettes: 'Recettes',
  courses: 'Courses',
};

interface Props {
  /** Bouton compte (☁︎) repris du chrome global ; masqué si Supabase off. */
  showAccount: boolean;
  connected: boolean;
  onOpenAccount: () => void;
}

/**
 * FC1 — Module Cuisine : header marque + segmented control (Semaine/Recettes/Courses),
 * FAB d'ajout sur Recettes uniquement, état d'onglet conservé, scroll remonté au changement.
 */
export default function CuisineView({ showAccount, connected, onOpenAccount }: Props) {
  const recipes = useStore((s) => s.recipes);
  const setSlot = useStore((s) => s.setSlot);

  const [seg, setSeg] = useState<Segment>('semaine');
  const [pick, setPick] = useState<PickTarget>(null);
  const [voiceIds, setVoiceIds] = useState<Set<string>>(new Set());

  const [toastMsg, setToastMsg] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = (msg: string) => {
    setToastMsg(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(''), 2200);
  };

  // Recettes disposant d'une note vocale (pour les marqueurs 🎙).
  useEffect(() => {
    void loadAudioKeys().then((keys) => setVoiceIds(new Set(keys)));
  }, [recipes]);

  const switchSeg = (s: Segment) => {
    setSeg(s);
    window.scrollTo({ top: 0 });
  };

  const pickType = pick?.slot === 'dej' ? 'Déjeuner' : 'Dîner';
  const pickDayNom = pick ? SEED_CONFIG.jours.find((j) => j.key === pick.dayKey)?.nom ?? '' : '';

  return (
    <div className="cz">
      <header className="cz-head">
        <div className="cz-brandrow">
          <div className="cz-brand">
            <span className="cz-mark" />
            Cuisine
          </div>
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
        <div className="cz-segmented" role="tablist">
          {(['semaine', 'recettes', 'courses'] as Segment[]).map((s) => (
            <button
              key={s}
              className="cz-seg"
              role="tab"
              aria-selected={seg === s}
              onClick={() => switchSeg(s)}
            >
              {SEG_LABEL[s]}
            </button>
          ))}
        </div>
      </header>

      <div className="cz-content">
        {seg === 'semaine' ? (
          <SemaineView
            voiceIds={voiceIds}
            onOpenPicker={(dayKey, slot) => setPick({ dayKey, slot })}
            onOpenRecipe={() => toast('Fiche recette détaillée — prochain lot (FC7)')}
            onGenerate={() => toast('Générateur de semaine — prochain lot (FC4)')}
            onGoValidate={() => switchSeg('recettes')}
            toast={toast}
          />
        ) : seg === 'recettes' ? (
          <div className="cz-pad" style={{ paddingTop: 8 }}>
            <BibliothequeView />
          </div>
        ) : (
          <div className="cz-pad" style={{ paddingTop: 8 }}>
            <CoursesView />
          </div>
        )}
      </div>

      {seg === 'recettes' && (
        <button
          className="cz-fab"
          aria-label="Ajouter une recette"
          onClick={() => toast('Ajout de recette (saisie / IA) — prochain lot (FC6)')}
        >
          <IconPlus size={24} />
        </button>
      )}

      {pick && (
        <RecipePickerSheet
          title={pick.slot === 'dej' ? 'Choisir un déjeuner' : 'Choisir un dîner'}
          sub={pickDayNom}
          type={pickType}
          recipes={recipes}
          voiceIds={voiceIds}
          onPick={(id) => {
            setSlot(pick.dayKey, pick.slot, id);
            setPick(null);
            toast('Repas ajouté');
          }}
          onClose={() => setPick(null)}
        />
      )}

      <div className={'cz-toast' + (toastMsg ? ' show' : '')}>
        {toastMsg && <IconCheck size={16} />}
        {toastMsg}
      </div>
    </div>
  );
}
