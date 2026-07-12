import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { MomentIcon, IconPlusThin } from './icons';
import { SHORT } from './dates';
import type { Moment, MomentType } from '../types';

// Ajout / édition d'un moment — rythme habituel ou rythme d'une période.
// Anti-page-blanche : suggestions en un tap + formulaire sur mesure.

interface Sugg {
  label: string;
  time: string;
  type: MomentType;
  jours: number[];
  lieu?: string;
}
const SUGGESTIONS: Sugg[] = [
  { label: 'Réveil', time: '07:30', type: 'reveil', jours: [0, 1, 2, 3, 4] },
  { label: 'École — dépose', time: '08:00', type: 'ecole', jours: [0, 1, 2, 3, 4], lieu: 'École' },
  { label: 'Déjeuner', time: '12:30', type: 'repas', jours: [0, 1, 2, 3, 4] },
  { label: 'Sieste', time: '13:30', type: 'sieste', jours: [0, 1, 2, 3, 4] },
  { label: 'Goûter', time: '17:00', type: 'gouter', jours: [0, 1, 2, 3, 4] },
  { label: 'Bain', time: '18:30', type: 'bain', jours: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'École — récupère', time: '16:30', type: 'ecole', jours: [0, 1, 2, 3, 4], lieu: 'École' },
  { label: 'Coucher', time: '20:00', type: 'coucher', jours: [0, 1, 2, 3, 4, 5, 6] },
];

interface Props {
  /** Période ciblée (undefined = rythme habituel). */
  periodeId?: string;
  periodeNom?: string;
  /** Moment édité (sinon ajout). */
  edit?: Moment;
  onClose: () => void;
  toast: (m: string) => void;
}

export default function MomentSheet({ periodeId, periodeNom, edit, onClose, toast }: Props) {
  const enfants = useNounou((s) => s.doc.enfants);
  const addMoment = useNounou((s) => s.addMoment);
  const updateMoment = useNounou((s) => s.updateMoment);
  const upsertEnfant = useNounou((s) => s.upsertEnfant);

  const defaultJours = periodeId ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const [label, setLabel] = useState(edit?.label ?? '');
  const [time, setTime] = useState(edit?.heure ?? '16:30');
  // Le type (icône) vient de la suggestion ou est conservé en édition ;
  // le formulaire sur mesure n'expose pas de sélecteur (cf. maquette).
  const type: MomentType = edit?.type ?? 'activite';
  const [jours, setJours] = useState<Set<number>>(new Set(edit?.jours ?? defaultJours));
  const [kids, setKids] = useState<Set<string>>(
    new Set(edit?.enfants?.length ? edit.enfants : enfants.map((e) => e.id)),
  );
  const [who, setWho] = useState(edit?.qui ?? '');
  const [lieu, setLieu] = useState(edit?.lieu ?? '');
  // F4-bis fiche A : raccourci « ＋ ajouter un enfant » SANS quitter la feuille
  // (la saisie du moment — intitulé/heure/jours — reste intacte, même état React).
  const [addingKid, setAddingKid] = useState(false);
  const [kidName, setKidName] = useState('');

  const addKid = () => {
    const p = kidName.trim();
    if (!p) return;
    const id = upsertEnfant({ prenom: p });
    setKids((prev) => new Set(prev).add(id)); // créé → auto-coché
    setKidName('');
    setAddingKid(false);
    toast(`${p} ajouté(e)`);
  };

  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  // F4-bis fiche A : l'association d'enfant est OPTIONNELLE — `enfants: []` signifie
  // déjà « tous les enfants » dans tout le modèle (JourneeView, MomentBrick, projection).
  // L'ancienne exigence (« Choisis au moins un enfant ») bloquait DUR un foyer neuf
  // post-F1 (zéro enfant seedé) : levée de contrainte UI, pas de changement de modèle.
  const applySugg = (s: Sugg) => {
    addMoment(
      {
        label: s.label,
        heure: s.time,
        type: s.type,
        jours: s.jours.slice(),
        enfants: [...kids],
        lieu: s.lieu,
      },
      periodeId,
    );
    toast(`« ${s.label} » ajouté`);
    onClose();
  };

  const save = () => {
    const l = label.trim();
    if (!l) return toast('Donne un intitulé');
    if (jours.size === 0) return toast('Choisis au moins un jour');
    const payload = {
      label: l,
      heure: time || '12:00',
      type,
      jours: [...jours].sort((a, b) => a - b),
      enfants: [...kids],
      qui: who.trim() || undefined,
      lieu: lieu.trim() || undefined,
    };
    if (edit) {
      updateMoment(edit.id, payload, periodeId);
      toast('Moment modifié');
    } else {
      addMoment(payload, periodeId);
      toast('Moment ajouté');
    }
    onClose();
  };

  const target = periodeId ? `Période · ${periodeNom ?? ''}` : 'Rythme habituel';

  return (
    <Sheet title={edit ? 'Modifier le moment' : 'Ajouter un moment'} sub={target} onClose={onClose}>
      {!edit && (
        <>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Suggestions — un tap pour ajouter
          </div>
          <div className="nz-suggest">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="nz-scard" onClick={() => applySugg(s)}>
                <span className="si">
                  <MomentIcon type={s.type} />
                </span>
                <span className="sl">{s.label}</span>
                <span className="st">{s.time}</span>
                <span className="sp">+</span>
              </button>
            ))}
          </div>
          <div className="cz-blab" style={{ marginTop: 18 }}>
            Ou créer sur mesure
          </div>
        </>
      )}

      <input
        className="cz-inp"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Intitulé (ex. Cours de piano)"
      />
      <div className="nz-row2" style={{ marginTop: 10 }}>
        <div style={{ width: 130 }}>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Heure
          </div>
          <input className="cz-inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="cz-blab" style={{ marginTop: 2 }}>
            Qui s’en occupe
          </div>
          <input className="cz-inp" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Optionnel" />
        </div>
      </div>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Jours
      </div>
      <div className="nz-quickdays">
        <button className="nz-qd" onClick={() => setJours(new Set([0, 1, 2, 3, 4]))}>
          Jours d’école
        </button>
        <button className="nz-qd" onClick={() => setJours(new Set([0, 1, 2, 3, 4, 5, 6]))}>
          Tous les jours
        </button>
      </div>
      <div className="nz-daysel">
        {SHORT.map((d, i) => (
          <button
            key={i}
            className="nz-dbtn"
            aria-pressed={jours.has(i)}
            onClick={() => setJours(toggle(jours, i))}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Enfant(s) — optionnel
      </div>
      <div className="nz-kidsel">
        {enfants.map((e) => (
          <button
            key={e.id}
            className="nz-kbtn"
            aria-pressed={kids.has(e.id)}
            onClick={() => setKids(toggle(kids, e.id))}
          >
            <span className="kd" style={{ background: e.couleur }}>
              {e.initiale}
            </span>
            {e.prenom}
          </button>
        ))}
        {!addingKid ? (
          <button className="nz-kbtn" onClick={() => setAddingKid(true)}>
            ＋ Ajouter un enfant
          </button>
        ) : (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input
              className="cz-inp"
              style={{ width: 150, margin: 0 }}
              autoFocus
              value={kidName}
              onChange={(e) => setKidName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKid()}
              placeholder="Prénom"
            />
            <button className="nz-kbtn" onClick={addKid} disabled={!kidName.trim()}>
              OK
            </button>
          </span>
        )}
      </div>
      <div className="nz-emptyline" style={{ padding: '4px 2px', textAlign: 'left' }}>
        Personne de coché = le moment vaut pour tous les enfants.
      </div>

      <div className="cz-blab" style={{ marginTop: 16 }}>
        Lieu (optionnel)
      </div>
      <input className="cz-inp" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Adresse / lieu" />

      <button className="cz-cta" onClick={save}>
        <IconPlusThin size={18} />
        {edit ? 'Enregistrer' : 'Ajouter le moment'}
      </button>
    </Sheet>
  );
}
