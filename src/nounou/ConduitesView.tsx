import { useEffect, useState } from 'react';
import { useNounou } from './useNounou';
import { loadAudioKeys } from '../lib/db';
import { IconPlus } from '../cuisine/icons';
import AddProtocoleSheet from './AddProtocoleSheet';
import ProtocoleSheet from './ProtocoleSheet';
import ProtocoleFormSheet from './ProtocoleFormSheet';
import { CONDUITE_LABEL, type ConduiteCateg } from '../types';

type Filter = 'all' | ConduiteCateg | 'todo';
const CHIPS: { key: Filter; label: string; dr?: boolean }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'sante', label: 'Santé' },
  { key: 'securite', label: 'Sécurité' },
  { key: 'quotidien', label: 'Quotidien' },
  { key: 'todo', label: '✦ À compléter', dr: true },
];

type SheetState = { k: 'add' } | { k: 'detail'; id: string } | { k: 'form'; id?: string } | null;

export default function ConduitesView({ toast }: { toast: (m: string) => void }) {
  const conduites = useNounou((s) => s.doc.conduites);
  const installModeles = useNounou((s) => s.installConduiteModeles);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [voiceIds, setVoiceIds] = useState<Set<string>>(new Set());

  const refreshVoice = () => void loadAudioKeys().then((k) => setVoiceIds(new Set(k)));
  useEffect(() => {
    refreshVoice();
  }, [conduites]);

  const list = conduites.filter((c) =>
    filter === 'all' ? true : filter === 'todo' ? c.aCompleter : c.categ === filter && !c.aCompleter,
  );

  const byId = (id?: string) => conduites.find((c) => c.id === id);

  return (
    <>
      <div className="nz-info" style={{ margin: '14px 16px 0' }}>
        <span>
          Vos consignes, écrites une fois et partagées. Les modèles violets sont <b>à compléter</b>.
        </span>
      </div>

      <div className="nz-chips">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            className={'nz-chip' + (c.dr ? ' dr' : '')}
            aria-pressed={filter === c.key}
            onClick={() => setFilter(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="nz-lib">
        {list.length === 0 ? (
          <div className="nz-dayempty">
            Aucune conduite ici.
            {/* F3 (Flow FTUE) : gabarits opt-in — pattern « importer » de Sécurité. */}
            {conduites.length === 0 && (
              <>
                <br />
                <button
                  className="nz-addlink"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    const n = installModeles();
                    toast(n ? `${n} gabarit(s) « à compléter » ajoutés — à vous de les remplir` : 'Gabarits déjà présents.');
                  }}
                >
                  ✦ Importer les gabarits (Fièvre, Étouffement…)
                </button>
              </>
            )}
          </div>
        ) : (
          list.map((c) => (
            <button
              key={c.id}
              className={'nz-librow' + (c.aCompleter ? ' draft' : '')}
              onClick={() => setSheet({ k: 'detail', id: c.id })}
            >
              <div className="nz-libtop">
                <div className="nm">{c.titre}</div>
              </div>
              <div className="nz-libtags">
                <span className="nz-tag role">{CONDUITE_LABEL[c.categ]}</span>
                {c.urgent && <span className="nz-tag urg">Urgent</span>}
                {voiceIds.has(c.id) && !c.aCompleter && <span className="nz-tag">Voix</span>}
                {c.aCompleter && <span className="nz-tag draft">✦ À compléter</span>}
              </div>
            </button>
          ))
        )}
      </div>

      <button className="cz-fab" aria-label="Ajouter un protocole" onClick={() => setSheet({ k: 'add' })}>
        <IconPlus size={24} />
      </button>

      {sheet?.k === 'add' && (
        <AddProtocoleSheet
          onRediger={() => setSheet({ k: 'form' })}
          onModele={(id) => setSheet({ k: 'form', id })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.k === 'detail' && byId(sheet.id) && (
        <ProtocoleSheet
          conduite={byId(sheet.id)!}
          onEdit={() => setSheet({ k: 'form', id: sheet.id })}
          onClose={() => setSheet(null)}
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

      {sheet?.k === 'form' && (
        <ProtocoleFormSheet
          edit={byId(sheet.id)}
          onClose={() => setSheet(null)}
          onSaved={(id) => setSheet({ k: 'detail', id })}
          toast={toast}
        />
      )}
    </>
  );
}
