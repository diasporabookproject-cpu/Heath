import { useState } from 'react';
import { useNounou } from './useNounou';
import { IconChevron, IconPlusThin } from './icons';
import NumeroSheet from './NumeroSheet';
import ContactSheet from './ContactSheet';
import RegleSheet from './RegleSheet';
import EnfantSheet from './EnfantSheet';
import type { Enfant, NounouContact, ReglePerm } from '../types';

// Onglet Fiche urgence (admin) : numéros, contacts, règles, fiches enfants.
// Tout est rédigé/confirmé par le parent (FN3.1). Alimente la page reçue.

type SheetState =
  | { k: 'numero'; index: number | null }
  | { k: 'contact'; edit?: NounouContact }
  | { k: 'regle'; edit?: ReglePerm }
  | { k: 'enfant'; edit?: Enfant }
  | null;

export default function FicheUrgenceView({ toast }: { toast: (m: string) => void }) {
  const doc = useNounou((s) => s.doc);
  const [sheet, setSheet] = useState<SheetState>(null);
  const u = doc.urgence;

  return (
    <div style={{ padding: '4px 16px 26px' }}>
      {/* Numéros d'urgence */}
      <div className="nz-mgsec" style={{ marginTop: 14 }}>
        En cas d’urgence
        <button className="nz-addlink" onClick={() => setSheet({ k: 'numero', index: null })}>
          <IconPlusThin size={14} /> Ajouter
        </button>
      </div>
      <div className="nz-cardflush">
        {u.numeros.length === 0 ? (
          <div className="nz-emptyline">Aucun numéro.</div>
        ) : (
          u.numeros.map((n, i) => (
            <div key={i} className="nz-brick">
              <span className="bi num">{n.numero}</span>
              <button className="bm" onClick={() => setSheet({ k: 'numero', index: i })}>
                <span className="bl">{n.label}</span>
                <span className="bs">{n.aVerifier ? 'À vérifier' : 'Confirmé'}</span>
              </button>
              <span className="brm" style={{ color: '#c7bdad' }}>
                <IconChevron size={18} />
              </span>
            </div>
          ))
        )}
      </div>
      <div className="nz-emptyline">
        Numéros pré-remplis pour le Maroc — <b>à vérifier</b>. Ajoute aussi ta clinique habituelle.
      </div>

      {/* Contacts */}
      <div className="nz-mgsec" style={{ marginTop: 22 }}>
        Contacts
        <button className="nz-addlink" onClick={() => setSheet({ k: 'contact' })}>
          <IconPlusThin size={14} /> Ajouter
        </button>
      </div>
      <div className="nz-cardflush">
        {u.contacts.length === 0 ? (
          <div className="nz-emptyline">Ajoute Maman, Papa, le pédiatre, une voisine de confiance…</div>
        ) : (
          u.contacts.map((c) => (
            <div key={c.id} className="nz-brick">
              <span className="bi">{c.nom.charAt(0).toUpperCase()}</span>
              <button className="bm" onClick={() => setSheet({ k: 'contact', edit: c })}>
                <span className="bl">{c.nom}</span>
                <span className="bs">{[c.role, c.tel].filter(Boolean).join(' · ')}</span>
              </button>
              <span className="brm" style={{ color: '#c7bdad' }}>
                <IconChevron size={18} />
              </span>
            </div>
          ))
        )}
      </div>

      {/* Règles & autorisations */}
      <div className="nz-mgsec" style={{ marginTop: 22 }}>
        Règles & autorisations
        <button className="nz-addlink" onClick={() => setSheet({ k: 'regle' })}>
          <IconPlusThin size={14} /> Ajouter
        </button>
      </div>
      <div className="nz-cardflush">
        {u.regles.length === 0 ? (
          <div className="nz-emptyline">Ce qui est autorisé ou interdit (écrans, sorties, qui récupère…).</div>
        ) : (
          u.regles.map((r) => (
            <div key={r.id} className="nz-brick">
              <span className={'bi ' + (r.permis ? 'ok' : 'no')}>{r.permis ? '✓' : '✗'}</span>
              <button className="bm" onClick={() => setSheet({ k: 'regle', edit: r })}>
                <span className="bl">{r.texte}</span>
                <span className="bs">{r.permis ? 'Autorisé' : 'Interdit'}</span>
              </button>
              <span className="brm" style={{ color: '#c7bdad' }}>
                <IconChevron size={18} />
              </span>
            </div>
          ))
        )}
      </div>

      {/* Fiches enfants */}
      <div className="nz-mgsec" style={{ marginTop: 22 }}>
        Fiches enfants
        <button className="nz-addlink" onClick={() => setSheet({ k: 'enfant' })}>
          <IconPlusThin size={14} /> Ajouter
        </button>
      </div>
      <div className="nz-cardflush">
        {doc.enfants.length === 0 ? (
          <div className="nz-emptyline">Ajoute un enfant pour renseigner sa fiche.</div>
        ) : (
          doc.enfants.map((e) => (
            <div key={e.id} className="nz-brick">
              <span className="bi" style={{ background: e.couleur, color: '#fff' }}>
                {e.initiale}
              </span>
              <button className="bm" onClick={() => setSheet({ k: 'enfant', edit: e })}>
                <span className="bl">{e.prenom}</span>
                <span className="bs">
                  {e.fiche?.allergies ? 'Allergie renseignée' : 'Fiche à compléter'}
                </span>
              </button>
              <span className="brm" style={{ color: '#c7bdad' }}>
                <IconChevron size={18} />
              </span>
            </div>
          ))
        )}
      </div>

      {sheet?.k === 'numero' && (
        <NumeroSheet index={sheet.index} onClose={() => setSheet(null)} toast={toast} />
      )}
      {sheet?.k === 'contact' && (
        <ContactSheet edit={sheet.edit} onClose={() => setSheet(null)} toast={toast} />
      )}
      {sheet?.k === 'regle' && <RegleSheet edit={sheet.edit} onClose={() => setSheet(null)} toast={toast} />}
      {sheet?.k === 'enfant' && (
        <EnfantSheet edit={sheet.edit} onClose={() => setSheet(null)} toast={toast} />
      )}
    </div>
  );
}
