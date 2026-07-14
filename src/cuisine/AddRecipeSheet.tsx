import { useEffect, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { estimateMacros, generateRecipeDraft, importRecipeText, importRecipeImage, aiAvailable } from '../lib/ai';
import { prepareImage, type PreparedImage } from '../lib/image';
import { isNative, pickPhoto as pickPhotoNative } from '../lib/platform';
import { parseRecipesJson } from '../lib/importRecipes';
import { nextRecipeId } from '../lib/recipeId';
import { AI_MONTHLY_LIMIT, remaining, normalizeQuota, currentMonth } from '../lib/quota';
import { ROLE_LABEL, reglesList, type CalciumFlag, type Recipe, type RecipeRole } from '../types';
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
  onCollections: () => void;
  /** F4.4 : « Modifier » de la ligne règles du foyer → ouvre Réglages (D2). */
  onOpenReglages: () => void;
  toast: (m: string) => void;
  /** Rôle pré-sélectionné pour « L'écrire » (amendement ② : entrée depuis le sélecteur). */
  initialRole?: RecipeRole;
}

type Step = 'choose' | 'ecrire' | 'instructions' | 'importjson';

/** Valeurs de départ pour « L'écrire » (duplication « copier puis adapter »). */
type ManualSeed = Pick<Recipe, 'nom' | 'role' | 'ingredients' | 'etapes' | 'kcal' | 'prot' | 'gluc' | 'lip' | 'calcium' | 'flag_calcium'>;

/**
 * F4.1 (lot Cuisine) — la feuille des TROIS VOIES (port maquette « Comment on
 * l'ajoute ? ») : ① L'écrire (tes mots, naît `Validé`) · ② À partir
 * d'instructions (lien / texte collé / description — photo en T4b ; brouillon
 * `Test` + relecture, quota serveur) · ③ Depuis une collection (packs).
 * ③ du GO T4 : le mot « IA » (et Générer/génération/✨) n'apparaît NULLE PART
 * ici — on nomme la source (lien, texte, photo), jamais l'outil.
 */
export default function AddRecipeSheet({ onClose, onCreated, onCollections, onOpenReglages, toast, initialRole }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité
  const suivi = useStore((s) => s.suivi); // F2.2 #2/#3 : MacroPreview + Calculer sous le flag
  const [canAi, setCanAi] = useState(false);
  const [seed] = useState<ManualSeed | null>(null);
  const app = useStore((s) => s.app);
  const rem = remaining(normalizeQuota(app.aiQuota, currentMonth()));

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    void aiAvailable().then(setCanAi);
    return () => cancelAnimationFrame(t);
  }, []);

  const openInstructions = () => {
    if (!canAi) return toast('Connecte-toi (☁︎) et sois en ligne pour importer des instructions');
    if (rem <= 0) return toast('Plus de mises en forme ce mois — écris-la, c’est illimité');
    setStep('instructions');
  };

  const title =
    step === 'choose'
      ? 'Nouvelle recette'
      : step === 'ecrire'
        ? 'Écris ta recette'
        : step === 'instructions'
          ? 'À partir d’instructions'
          : 'Importer (JSON)';

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {title}
            {step === 'choose' && <small>Comment on l’ajoute ?</small>}
            {step === 'ecrire' && suivi && <small>Les macros sont calculées, pas saisies</small>}
          </div>
          <button className="cz-x" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="cz-sheetbody">
          {step === 'choose' && (
            <div style={{ paddingTop: 8 }}>
              <button className="cz-opt2" onClick={() => setStep('ecrire')}>
                <span className="ic pen">✍️</span>
                <span className="ot">
                  <span className="h">L’écrire</span>
                  <span className="d">Tes mots suffisent — « une bonne pincée » compris.</span>
                </span>
              </button>
              <button className="cz-opt2" onClick={openInstructions} style={{ opacity: canAi && rem > 0 ? 1 : 0.6 }}>
                <span className="ic imp">📄</span>
                <span className="ot">
                  <span className="h">À partir d’instructions</span>
                  <span className="d">
                    {!canAi
                      ? 'En ligne uniquement — connecte-toi (☁︎) d’abord.'
                      : rem > 0
                        ? 'Un lien, un texte collé, une description — mise au format pour toi.'
                        : 'Plus de mises en forme ce mois — écris-la, c’est illimité.'}
                  </span>
                </span>
                {canAi && <span className="cz-quotab">{rem} / {AI_MONTHLY_LIMIT} ce mois</span>}
              </button>
              <button className="cz-opt2" onClick={onCollections}>
                <span className="ic imp">📚</span>
                <span className="ot">
                  <span className="h">Depuis une collection</span>
                  <span className="d">Des recettes prêtes, à copier chez toi.</span>
                </span>
              </button>
            </div>
          )}

          {step === 'ecrire' && <EcrireForm seed={seed} suivi={suivi} initialRole={initialRole} onCreated={onCreated} toast={toast} onJson={() => setStep('importjson')} />}
          {step === 'instructions' && (
            <InstructionsForm
              onCreated={onCreated}
              onEcrire={() => setStep('ecrire')}
              onOpenReglages={onOpenReglages}
              toast={toast}
            />
          )}
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

/** F4.2 — « L'écrire » : zones de texte NATURELLES (recettes de famille), la
 * structure (courses, ×personnes) est dérivée en coulisse. Zéro champ macro à
 * saisir ; zéro widget allergène (D2 — les restrictions vivent au foyer). */
function EcrireForm({
  seed,
  suivi,
  initialRole,
  onCreated,
  toast,
  onJson,
}: {
  seed: ManualSeed | null;
  suivi: boolean;
  initialRole?: RecipeRole;
  onCreated: (id: string) => void;
  toast: (m: string) => void;
  onJson: () => void;
}) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [nom, setNom] = useState(seed?.nom ?? '');
  // Rôle par défaut = « Plat » (cas limite F4.2) — ou celui du créneau d'origine
  // quand on arrive du sélecteur de composant (amendement ②).
  const [role, setRole] = useState<RecipeRole>(seed?.role ?? initialRole ?? 'plat');
  const [portions, setPortions] = useState(4);
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
    // « L'écrire » = recette de l'auteur → naît « Validé » (jamais en relecture).
    upsertRecipe({
      id,
      nom: nom.trim(),
      role,
      statut: 'Validé',
      portions,
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
        <div className="cz-blab">Ingrédients (une ligne = un ingrédient{role === 'acc' ? ' · pour 100 g' : ''})</div>
        <textarea
          className="cz-ta"
          rows={5}
          value={ingredients}
          onChange={(e) => { setIngredients(e.target.value); setMacros(null); }}
          placeholder={'poulet 200 g\nriz cuit 110 g\nune bonne pincée de sel\nun filet d’huile d’olive'}
        />
      </div>
      <div className="cz-block">
        <div className="cz-blab">Préparation (une étape par ligne)</div>
        <textarea
          className="cz-ta"
          rows={4}
          value={etapes}
          onChange={(e) => setEtapes(e.target.value)}
          placeholder={'Fais revenir le poulet.\nAjoute le riz, laisse mijoter 15 min.\nSers bien chaud.'}
        />
      </div>
      {/* F2.2 #2/#3 : bloc Macros sous le flag — OFF, l'estimation reste faite en
          coulisse à l'enregistrement (save), rien n'est perdu. */}
      {suivi && (
        <div className="cz-block">
          <div className="cz-blab">Macros</div>
          <button className="cz-calcbtn" onClick={compute} disabled={calc}>
            {calc ? <IconLoader size={16} className="cz-spin" /> : <IconStar size={16} />}
            {calc ? 'Calcul…' : 'Calculer les macros à partir des ingrédients'}
          </button>
          <MacroPreview m={macros} />
        </div>
      )}
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

/** F4.3 + F4.4 (T4b) — UN champ (lien / texte collé / description) + UNE photo.
 * Le contenu désambiguïse (texte long/collé = conversion ; court = intention ;
 * photo = lecture vision). Les règles du foyer (T3) s'appliquent D'OFFICE :
 * montrées AVANT (G1, ligne « J'adapte selon… » + Modifier), tracées APRÈS
 * (G3, `adapteSelon` affiché à la relecture). G2 par topologie : cette fonction
 * est l'UNIQUE point de persistance des imports et écrit `statut: 'Test'` en
 * dur — les seules sorties de `Test` sont les surfaces de relecture. */
function InstructionsForm({
  onCreated,
  onEcrire,
  onOpenReglages,
  toast,
}: {
  onCreated: (id: string) => void;
  /** Repli doux : photo/lien illisible → bascule vers « L'écrire ». */
  onEcrire: () => void;
  onOpenReglages: () => void;
  toast: (m: string) => void;
}) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const consumeAi = useStore((s) => s.consumeAi);
  const regles = useStore((s) => s.regles);
  const app = useStore((s) => s.app);
  const rem = remaining(normalizeQuota(app.aiQuota, currentMonth()));
  const [text, setText] = useState('');
  const [adaptation, setAdaptation] = useState('');
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [failNote, setFailNote] = useState('');
  const liste = reglesList(regles);

  // Web : le <input type=file> passe le fichier ici. Natif : ce chemin n'est
  // jamais emprunté (le bouton appelle le prompt caméra — cf. onPickNative).
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await prepareImage(file));
      setFailNote('');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  // Natif (repli Q5) : prompt système « Prendre une photo » OU « Depuis la
  // galerie » — les deux chemins que la WebView ne proposait pas.
  const onPickNative = async () => {
    const blob = await pickPhotoNative();
    if (!blob) return; // annulé
    try {
      setPhoto(await prepareImage(blob));
      setFailNote('');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const create = async () => {
    const v = text.trim();
    if (!v && !photo) return toast('Colle une recette, décris-la — ou prends-la en photo');
    if (rem <= 0) return toast('Plus de mises en forme ce mois — écris-la, c’est illimité');
    setBusy(true);
    setFailNote('');
    try {
      const opts = { regles: liste, adaptation: adaptation.trim() || undefined };
      // Photo présente = lecture vision ; sinon texte long/collé = conversion,
      // court = intention à produire (désambiguïsation par l'entrée).
      const d = photo
        ? await importRecipeImage(photo.base64, photo.mediaType, opts)
        : v.length > 100 || v.includes('\n')
          ? await importRecipeText(v, opts)
          : await generateRecipeDraft(v, opts);
      const rr = roleFromDraft(d.role);
      const id = nextRecipeId(recipes, rr);
      upsertRecipe({
        id,
        nom: d.nom?.trim() || 'Recette importée',
        role: rr,
        statut: 'Test',
        origineIA: true,
        adapteSelon: liste.length ? liste : undefined, // G3 : la trace vit dans le doc
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
      // Échec honnête, jamais dur : message réel + repli vers « L'écrire ».
      setFailNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="cz-block" style={{ marginTop: 2 }}>
        <div className="cz-blab">Un lien, un texte collé, ou décris ce que tu veux</div>
        <textarea
          className="cz-ta"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Ex. « Tajine de poulet léger, citron confit, pour 4 »\n— ou colle la recette d’un blog / d’un post.'}
          autoFocus
        />
      </div>
      <div className="cz-block">
        {/* Natif : bouton → prompt caméra/galerie (pickPhotoNative). Web : label
            + <input type=file> (le chooser web offre déjà les deux sur mobile). */}
        {isNative ? (
          <button type="button" className="cz-photobtn" onClick={() => void onPickNative()}>
            {photo ? (
              <>
                <img src={URL.createObjectURL(photo.blob)} alt="" />
                <span>
                  Photo prête ({photo.width}×{photo.height}) — appuie pour la changer
                </span>
              </>
            ) : (
              <span>📷 Ou prends la recette en photo (page de livre, capture)</span>
            )}
          </button>
        ) : (
          <label className="cz-photobtn">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {photo ? (
              <>
                <img src={URL.createObjectURL(photo.blob)} alt="" />
                <span>
                  Photo prête ({photo.width}×{photo.height}) — appuie pour la changer
                </span>
              </>
            ) : (
              <span>📷 Ou prends la recette en photo (page de livre, capture)</span>
            )}
          </label>
        )}
        {photo && (
          <button className="cz-cta ghost" style={{ marginTop: 6 }} onClick={() => setPhoto(null)}>
            Retirer la photo
          </button>
        )}
      </div>
      <div className="cz-block">
        <div className="cz-blab">Adapte-la, si tu veux</div>
        <input
          className="cz-inp"
          value={adaptation}
          onChange={(e) => setAdaptation(e.target.value)}
          placeholder="pour 6 · sans porc · plus léger"
        />
      </div>
      {/* G1 — les règles appliquées sont TOUJOURS montrées, jamais une boîte noire. */}
      <div className="cz-reglesline">
        <span>
          {liste.length ? (
            <>
              J’adapte selon les règles de ton foyer : <b>{liste.join(' · ')}</b>{' '}
              <i className="cz-averifier">à vérifier</i>
            </>
          ) : (
            <>Aucune règle du foyer — rien ne sera adapté.</>
          )}
        </span>
        <button className="cz-linkbtn" onClick={onOpenReglages}>
          Modifier
        </button>
      </div>
      <div className="cz-estnote" style={{ marginBottom: 10 }}>{rem} / {AI_MONTHLY_LIMIT} mises en forme ce mois</div>
      {failNote && (
        <div className="cz-relwarn" style={{ marginBottom: 10 }}>
          {failNote}
          <button className="cz-linkbtn" onClick={onEcrire} style={{ marginLeft: 8 }}>
            L’écrire à la place
          </button>
        </div>
      )}
      <button className="cz-cta draft" onClick={create} disabled={busy}>
        {busy ? <IconLoader size={18} className="cz-spin" /> : <IconStar size={18} />}
        {busy ? (photo ? 'Lecture de la photo…' : 'Mise au format…') : 'Créer la recette'}
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
