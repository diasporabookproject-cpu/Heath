import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import type { RecipeRole } from '../types';
import { cleanText } from '../lib/sanitize';
import { recipeEmoji } from '../lib/emoji';
import { PACKS } from '../data/packs';
import { isPackInstalled } from '../lib/packs';
import { IconSearch, IconMic, IconFav } from './icons';
import Em from '../ui/Em';
import RelectureSheet from './RelectureSheet';

// T5 (SPEC 6, proto) — sortir du « bordélique » : les chips de filtre MEURENT,
// remplacées par des SECTIONS PAR MOMENT repliables (Q3 : ordre des repas ·
// Q4 : dépliées par défaut). Les collections quittent la tête → « Besoin
// d'inspiration ? » en bas (plein) ou grandes tuiles (vide).

const SECTIONS: { role: RecipeRole; label: string }[] = [
  { role: 'petitdej', label: 'Petit-déj' },
  { role: 'entree', label: 'Entrées' },
  { role: 'plat', label: 'Plats' },
  { role: 'acc', label: 'Accompagnements' },
  { role: 'soupe', label: 'Soupes' },
  { role: 'gouter', label: 'Goûters' },
  { role: 'dessert', label: 'Desserts' },
  { role: 'boisson', label: 'Boissons' },
];

/** Teintes proto : tuiles de l'état vide (amber/gold/sage) ; carrousel « inspiration » (gold/sage/rose). */
const TILE_TINTS = ['amber', 'gold', 'sage'];
const CARO_TINTS = ['gold', 'sage', 'rose'];

interface Props {
  voiceIds: Set<string>;
  filter: string;
  setFilter: (f: string) => void;
  onOpenRecipe: (id: string) => void;
  onOpenCollections: (packId?: string) => void;
  /** T5 : « créez votre recette » de l'état vide → les 3 voies. */
  onCreate: () => void;
  toast: (m: string) => void;
}

/** FC5/FC15/FC18 — Bibliothèque : sections par moment, favoris, relecture. */
export default function RecettesView({ voiceIds, filter, setFilter, onOpenRecipe, onOpenCollections, onCreate, toast }: Props) {
  const recipes = useStore((s) => s.recipes);
  const toggleFav = useStore((s) => s.toggleFav);
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [folded, setFolded] = useState<Set<RecipeRole>>(new Set()); // Q4 : dépliées par défaut
  const [relire, setRelire] = useState<{ startId?: string } | null>(null);

  // Compat : « X à valider » de la vue semaine arrivait avec le filtre `draft`
  // (les chips sont mortes) → il ouvre désormais la FILE DE RELECTURE direct.
  useEffect(() => {
    if (filter === 'draft') {
      setRelire({});
      setFilter('all');
    }
  }, [filter, setFilter]);

  // File de relecture (L3-3) : périmètre = tous les brouillons `Test`.
  const draftCount = useMemo(() => recipes.filter((r) => r.statut === 'Test').length, [recipes]);
  const visibles = useMemo(() => recipes.filter((r) => r.statut !== 'Écarté'), [recipes]);

  const bySection = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const eligible = visibles
      .filter((r) => (needle ? r.nom.toLowerCase().includes(needle) : true))
      .filter((r) => (favOnly ? !!r.fav : true))
      .sort(
        (a, b) =>
          (a.statut === 'Test' ? 0 : 1) - (b.statut === 'Test' ? 0 : 1) ||
          a.nom.localeCompare(b.nom, 'fr'),
      );
    return SECTIONS.map((s) => ({ ...s, items: eligible.filter((r) => r.role === s.role) })).filter(
      (s) => s.items.length > 0,
    );
  }, [visibles, q, favOnly]);

  const toggleFold = (role: RecipeRole) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });

  // ── ÉTAT VIDE (proto) : héros → collections en GRANDES TUILES + créer ──
  if (visibles.length === 0) {
    return (
      <div>
        <div className="cz-emptyhero">
          <Em ch="🧑‍🍳" size={58} />
          <h3>Votre bibliothèque est vide</h3>
          <p>
            Piochez dans une collection pour bien démarrer,
            <br />
            ou ajoutez vos propres recettes.
          </p>
        </div>
        <div className="cz-startlabel">Pour démarrer · les collections</div>
        <div className="cz-collsv">
          {PACKS.map((p, i) => (
            <button key={p.id} className={'cz-pkt cz-cx ' + TILE_TINTS[i % TILE_TINTS.length]} onClick={() => onOpenCollections(p.id)}>
              {!isPackInstalled(p, recipes) && <span className="newb2">NOUVEAU</span>}
              <span className="cxe">
                <Em ch={p.emoji} size={32} />
              </span>
              <span className="cxt">
                <b>{p.nom}</b>
                <i>{p.description}</i>
                <span className="n">{p.recettes.length} recettes</span>
              </span>
              <span className="cxg">›</span>
            </button>
          ))}
        </div>
        <button className="cz-allink" onClick={() => onOpenCollections()}>
          Voir toutes les collections →
        </button>
        <div className="cz-orcreate">
          <div className="ol">— ou —</div>
          <button className="cz-createbtn" onClick={onCreate}>
            <span className="p">＋</span> Créer ma première recette
          </button>
        </div>
      </div>
    );
  }

  // ── ÉTAT PLEIN (proto) : recherche + favoris · sections · inspiration en bas ──
  return (
    <div>
      <div className="cz-searchrow">
        <div className="cz-search">
          <IconSearch size={18} />
          <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button
          className={'cz-startog' + (favOnly ? ' on' : '')}
          aria-pressed={favOnly}
          aria-label="Filtrer les favoris"
          onClick={() => setFavOnly((v) => !v)}
        >
          <IconFav size={18} filled={favOnly} />
        </button>
      </div>

      {draftCount > 0 && (
        <div className="cz-pad" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <button className="cz-sigrow" onClick={() => setRelire({})}>
            <span className="e">✦</span>
            <span className="st">
              <b>{draftCount} nouvelle{draftCount > 1 ? 's' : ''} recette{draftCount > 1 ? 's' : ''} à relire</b>
              <i>2 minutes et c’est réglé</i>
            </span>
            <span className="go">Relire</span>
          </button>
        </div>
      )}

      {bySection.length === 0 ? (
        <p className="cz-emptynote" style={{ padding: '18px 16px' }}>
          Aucune recette ici.
        </p>
      ) : (
        bySection.map((s) => {
          const open = !folded.has(s.role);
          return (
            <div key={s.role}>
              <button className="cz-sech" onClick={() => toggleFold(s.role)} aria-expanded={open}>
                <b>{s.label}</b>
                <span className="ct">{s.items.length}</span>
                <span className="cv">{open ? '⌄' : '›'}</span>
              </button>
              {open && (
                <div className="cz-pad cz-lib" style={{ paddingTop: 0 }}>
                  {s.items.map((r) => {
                    const draft = r.statut === 'Test';
                    return (
                      <button
                        key={r.id}
                        className={'cz-librow' + (draft ? ' draft' : '')}
                        onClick={() => (draft ? setRelire({ startId: r.id }) : onOpenRecipe(r.id))}
                      >
                        <div className="cz-libtop">
                          <span
                            className={'cz-starbtn' + (r.fav ? ' on' : '')}
                            role="button"
                            tabIndex={0}
                            aria-label="Favori"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav(r.id);
                            }}
                          >
                            <IconFav size={16} filled={r.fav} />
                          </span>
                          {/* F7.1 — repère emoji : mot-clé → repli rôle, jamais choisi à la main. */}
                          <span className="cz-remoji">
                            <Em ch={recipeEmoji(r)} size={24} />
                          </span>
                          <span className="nm clamp2" style={{ flex: 1, fontWeight: 600 }}>
                            {cleanText(r.nom)}
                          </span>
                          {/* T5 : le tag de rôle MEURT (la section porte l'info) ; ✦ reste. */}
                          {draft && <span className="cz-tag draft">✦ À valider</span>}
                        </div>
                        {voiceIds.has(r.id) && (
                          <div className="cz-cardmeta">
                            <span className="cz-vchip">
                              <IconMic size={11} />
                              vocal
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* T5 — les collections vivent EN BAS : « Besoin d'inspiration ? ». */}
      <div className="cz-inspi">
        <h4>Besoin d’inspiration ?</h4>
        <div className="isub">Des collections à copier, puis à adapter.</div>
        <div className="cz-carousel">
          {PACKS.map((p, i) => (
            <button key={p.id} className={'cz-cc ' + CARO_TINTS[i % CARO_TINTS.length]} onClick={() => onOpenCollections(p.id)}>
              <span className="cce">
                <Em ch={p.emoji} size={28} />
              </span>
              <b>{p.nom}</b>
              <i>{p.description}</i>
              <span className="n">{p.recettes.length} recettes</span>
            </button>
          ))}
        </div>
        <button className="cz-allink" onClick={() => onOpenCollections()}>
          Voir toutes les collections →
        </button>
      </div>

      {relire && (
        <RelectureSheet
          startId={relire.startId}
          onClose={() => setRelire(null)}
          onOpenRecipe={onOpenRecipe}
          toast={toast}
        />
      )}
    </div>
  );
}
