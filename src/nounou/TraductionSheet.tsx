import { useState } from 'react';
import { useNounou } from './useNounou';
import Sheet from './Sheet';
import { collectStrings } from './collect';
import { translateTexts } from './translate';
import { NOUNOU_LANGS, type NounouLangue } from '../types';

// FN4.2 — Génère et fige les traductions d'une langue.
// Planning (non-sensible) → auto, actif. Sensible (santé/urgences/conduites/
// allergies) → « à valider » jusqu'à relecture du parent, puis figé.

export default function TraductionSheet({
  langue,
  onClose,
  toast,
}: {
  langue: NounouLangue;
  onClose: () => void;
  toast: (m: string) => void;
}) {
  const doc = useNounou((s) => s.doc);
  const mergeTranslations = useNounou((s) => s.mergeTranslations);
  const validateTranslation = useNounou((s) => s.validateTranslation);
  const editTranslation = useNounou((s) => s.editTranslation);
  const rejectTranslation = useNounou((s) => s.rejectTranslation);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const info = NOUNOU_LANGS.find((l) => l.code === langue)!;
  const cache = doc.translations?.[langue] ?? {};
  const entries = Object.entries(cache);
  const aValider = entries.filter(([, e]) => e.status === 'aValider');
  const autoCount = entries.filter(([, e]) => e.status === 'auto').length;
  const valideCount = entries.filter(([, e]) => e.status === 'valide').length;

  const generate = async () => {
    setBusy(true);
    try {
      const items = collectStrings(doc);
      if (items.length === 0) return toast('Rien à traduire pour l’instant');
      const trs = await translateTexts(langue, items.map((i) => i.text));
      if (!trs) return toast('Traduction indisponible');
      mergeTranslations(
        langue,
        items.map((it, i) => ({ src: it.text, tr: trs[i] ?? '', sensible: it.sensible })),
      );
      toast('Traductions générées');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Échec de la traduction');
    } finally {
      setBusy(false);
    }
  };

  const validateAll = () => {
    aValider.forEach(([src]) => validateTranslation(langue, src));
    toast('Tout validé');
  };

  return (
    <Sheet title={`Traduction · ${info.nom}`} sub="Vous écrivez en français ; ceci est dérivé" onClose={onClose}>
      <div className="nz-info draft" style={{ marginTop: 2 }}>
        <span>
          Tout est traduit et envoyé. Le <b>sensible</b> (santé, urgences, conduites, allergies) est
          marqué <b>« à relire »</b> — vérifiez-le quand vous pouvez : valider, éditer, ou rejeter.
        </span>
      </div>

      <button className="cz-cta" onClick={generate} disabled={busy}>
        {busy ? 'Traduction en cours…' : entries.length ? 'Mettre à jour les traductions' : 'Générer les traductions'}
      </button>

      {entries.length > 0 && (
        <div className="nz-emptyline" style={{ marginTop: 12 }}>
          Planning : <b>{autoCount}</b> · sensible relu : <b>{valideCount}</b> · sensible à relire :{' '}
          <b>{aValider.length}</b>
        </div>
      )}

      {aValider.length > 0 && (
        <>
          <div className="nz-mgsec" style={{ marginTop: 14 }}>
            À relire (sensible)
            <button className="nz-addlink" onClick={validateAll}>
              Tout valider
            </button>
          </div>
          {aValider.map(([src, e]) => (
            <div key={src} className="nz-trrow draft">
              <div className="nz-trsrc">{src}</div>
              {editing === src ? (
                <>
                  <textarea
                    className={'cz-ta' + (info.rtl ? ' ar' : '')}
                    rows={2}
                    dir={info.rtl ? 'rtl' : 'ltr'}
                    value={editText}
                    onChange={(ev) => setEditText(ev.target.value)}
                  />
                  <div className="nz-tractions">
                    <button
                      className="nz-trbtn ok"
                      onClick={() => {
                        editTranslation(langue, src, editText.trim());
                        setEditing(null);
                        toast('Traduction éditée et validée');
                      }}
                    >
                      Enregistrer
                    </button>
                    <button className="nz-trbtn" onClick={() => setEditing(null)}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={'nz-trtxt' + (info.rtl ? ' ar' : '')}>{e.tr || '—'}</div>
                  <div className="nz-tractions">
                    <button className="nz-trbtn ok" onClick={() => validateTranslation(langue, src)}>
                      Valider
                    </button>
                    <button
                      className="nz-trbtn"
                      onClick={() => {
                        setEditing(src);
                        setEditText(e.tr);
                      }}
                    >
                      Éditer
                    </button>
                    <button className="nz-trbtn no" onClick={() => rejectTranslation(langue, src)}>
                      Rejeter
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}

      {entries.length > 0 && aValider.length === 0 && (
        <div className="nz-info" style={{ marginTop: 14 }}>
          <span>Tout le sensible est relu. La page reçue en {info.nom} est à jour.</span>
        </div>
      )}
    </Sheet>
  );
}
