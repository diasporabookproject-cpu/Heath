import { useEffect, useMemo, useState } from 'react';
import { useSheetBack } from '../ui/primitives';
import { useStore } from '../store/useStore';
import { PACKS } from '../data/packs';
import { buildInstall, isPackInstalled, missingSeeds, seedExists } from '../lib/packs';
import { ROLE_LABEL, type Pack } from '../types';

// L3-4 — Collections : des packs de recettes prêtes, copiées CHEZ l'utilisateur
// (proto `sh-p2` liste + `sh-p1` détail). Installées = à elle : modifiables,
// supprimables. Anti-doublon par nom (cf. lib/packs).

interface Props {
  initialPackId?: string;
  onClose: () => void;
  toast: (m: string) => void;
}

export default function CollectionsSheet({ initialPackId, onClose, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const upsertRecipe = useStore((s) => s.upsertRecipe);
  const [shown, setShown] = useState(false);
  useSheetBack(onClose); // B3 : le retour Android ferme cette feuille en priorité
  const [sel, setSel] = useState<Pack | null>(() => PACKS.find((p) => p.id === initialPackId) ?? null);
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set((PACKS.find((p) => p.id === initialPackId) ?? { recettes: [] }).recettes.map((r) => r.nom)),
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const openPack = (p: Pack) => {
    setChosen(new Set(p.recettes.map((r) => r.nom)));
    setSel(p);
  };
  const toggle = (nom: string) =>
    setChosen((prev) => {
      const n = new Set(prev);
      if (n.has(nom)) n.delete(nom);
      else n.add(nom);
      return n;
    });

  const toAdd = useMemo(() => (sel ? buildInstall(sel, recipes, chosen) : []), [sel, recipes, chosen]);

  const install = () => {
    if (!sel) return;
    toAdd.forEach(upsertRecipe);
    toast(toAdd.length ? `${toAdd.length} recette(s) ajoutée(s) — à toi ✓` : 'Déjà dans ta bibliothèque');
    onClose();
  };

  return (
    <>
      <div className={'cz-overlay' + (shown ? ' show' : '')} onClick={onClose} />
      <div className={'cz-sheet' + (shown ? ' show' : '')} role="dialog" aria-modal="true">
        <div className="cz-handle" />
        <div className="cz-sheethead">
          <div className="ttl">
            {sel ? (
              <>
                {sel.emoji} {sel.nom}
                <small>
                  {sel.recettes.length} recettes — modifiables à volonté
                </small>
              </>
            ) : (
              <>
                Collections
                <small>Copie, adapte, c’est à toi — sans rien retaper</small>
              </>
            )}
          </div>
          <button className="cz-x" onClick={sel ? () => setSel(null) : onClose} aria-label="Fermer">
            {sel ? '‹' : '✕'}
          </button>
        </div>
        <div className="cz-sheetbody">
          {!sel ? (
            <div style={{ paddingTop: 6 }}>
              {PACKS.map((p) => {
                const installed = isPackInstalled(p, recipes);
                const miss = missingSeeds(p, recipes).length;
                return (
                  <button key={p.id} className="cz-librow" style={{ marginBottom: 9 }} onClick={() => openPack(p)}>
                    <div className="cz-libtop">
                      <span style={{ fontSize: 22 }}>{p.emoji}</span>
                      <span className="nm" style={{ flex: 1, fontWeight: 600 }}>{p.nom}</span>
                      <span className={'cz-tag' + (installed ? ' ok' : ' draft')}>
                        {installed ? 'Installée ✓' : `Nouveau · ${miss}`}
                      </span>
                    </div>
                    <div className="cz-cardmeta" style={{ marginTop: 4 }}>{p.description}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ paddingTop: 4 }}>
              <div className="cz-review" style={{ marginBottom: 10 }}>{sel.description}</div>
              {sel.recettes.map((s) => {
                const already = seedExists(s, recipes);
                const on = chosen.has(s.nom) && !already;
                return (
                  <button
                    key={s.nom}
                    className="cz-librow"
                    style={{ marginBottom: 8, opacity: already ? 0.55 : 1 }}
                    onClick={() => !already && toggle(s.nom)}
                    disabled={already}
                  >
                    <div className="cz-libtop">
                      <span className={'cz-ck' + (on || already ? ' on' : '')}>{on || already ? '✓' : ''}</span>
                      <span className="nm" style={{ flex: 1, fontWeight: 600 }}>{s.nom}</span>
                      <span className="cz-tag role">{ROLE_LABEL[s.role]}</span>
                    </div>
                    {already && (
                      <div className="cz-cardmeta" style={{ marginTop: 4 }}>
                        <span>Déjà dans ta bibliothèque</span>
                      </div>
                    )}
                  </button>
                );
              })}
              <div className="cz-estnote" style={{ margin: '6px 0 10px' }}>
                Installées = à toi : modifiables, supprimables.
              </div>
              <button className="cz-cta" onClick={install} disabled={toAdd.length === 0}>
                {toAdd.length > 0 ? `Ajouter les ${toAdd.length} recette${toAdd.length > 1 ? 's' : ''}` : 'Tout est déjà là ✓'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
