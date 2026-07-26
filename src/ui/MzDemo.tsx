import { useState } from 'react';
import { MzScreen, MzScroll, PageHero, ActionBar, Card, Pill, Chips, Chip, Sheet, useToast } from './primitives';

// Vitrine interne des primitives mz- (critère de fini L0-2).
// Accessible via #mz-demo. Non liée à la navigation de prod.

export default function MzDemo() {
  const [rtl, setRtl] = useState(false);
  const [seg, setSeg] = useState('semaine');
  const [flt, setFlt] = useState('tous');
  const [sheet, setSheet] = useState(false);
  const { toast, node } = useToast();

  return (
    <MzScreen rtl={rtl}>
      <PageHero
        role="cuisine"
        picto="🥘"
        title="Design system · mz-"
        status={
          <>
            <b>Vitrine des primitives</b> · Lot 0
          </>
        }
        onBack={() => toast('‹ Retour (démo)')}
        backLabel="‹ Démo"
        lang={{ label: rtl ? 'العربية' : 'Français', onClick: () => setRtl((v) => !v) }}
        segments={[
          { key: 'semaine', label: 'Semaine' },
          { key: 'biblio', label: 'Bibliothèque' },
          { key: 'courses', label: 'Courses' },
        ]}
        active={seg}
        onSeg={setSeg}
      />

      <MzScroll>
        <div className="mz-lab">Héros « prochain »</div>
        <button className="mz-hero grn" onClick={() => toast('Héros tapé')}>
          <span className="halo" />
          <span className="g">🥘</span>
          <span>
            <span className="lab">PROCHAIN · CUISINE</span>
            <h3>Déjeuner — Kefta, riz &amp; légumes</h3>
            <div className="sub">Pour 4 · tout est sur la page de Khadija</div>
          </span>
          <span className="t">12:30</span>
        </button>

        <div className="mz-lab">Carte-personne · états & pastille</div>
        <div className="mz-prow">
          <span className="mz-tav vio">🧸</span>
          <span>
            <h4>Fatima · Nounou</h4>
            <div className="st w">
              <b>● Du nouveau à envoyer</b>
            </div>
          </span>
          <Pill label="Envoyer" onClick={() => toast('Envoyer')} />
        </div>
        <div className="mz-prow">
          <span className="mz-tav grn">🥘</span>
          <span>
            <h4>Khadija · Cuisine</h4>
            <div className="st g">
              <b>✓ Tout est transmis</b> · lue hier
            </div>
          </span>
          <span className="chev">›</span>
        </div>

        <div className="mz-lab">Bande de jours</div>
        <div className="mz-dstrip">
          {['SAM 4', 'DIM 5', 'LUN 6', 'MAR 7', 'MER 8'].map((d, i) => {
            const [w, n] = d.split(' ');
            return (
              <div key={d} className={'mz-dchip vio' + (i === 2 ? ' on' : '')}>
                {i === 2 && <span className="dot" />}
                <div className="dw">{w}</div>
                <div className="dn">{n}</div>
              </div>
            );
          })}
        </div>

        <div className="mz-lab">Chips de filtre</div>
        <Chips>
          {['tous', 'fav', 'plat', 'entree'].map((k) => (
            <Chip key={k} label={k === 'tous' ? 'Tout' : k === 'fav' ? '★ Favoris' : k} on={flt === k} onClick={() => setFlt(k)} />
          ))}
        </Chips>

        <div className="mz-lab">Rangées</div>
        <button className="mz-mrow" onClick={() => toast('Rangée')}>
          <span className="e" style={{ background: 'var(--mz-grnT)' }}>🍲</span>
          <span>
            <h4>Kefta de bœuf, riz &amp; légumes</h4>
            <i>Plat · Marocain du quotidien</i>
          </span>
        </button>
        <button className="mz-mrow dash" onClick={() => toast('Vide')}>
          <span className="e" style={{ background: 'var(--mz-grnT)' }}>🍽️</span>
          <span>
            <h4>Mercredi — vide</h4>
            <i>tap pour composer</i>
          </span>
        </button>

        <div className="mz-lab">Carte + bouton feuille</div>
        <Card>
          <div style={{ fontWeight: 800 }}>Une carte blanche ombrée</div>
          <div className="mz-sm" style={{ marginTop: 4 }}>Rayons 18–24 px, ombre douce.</div>
        </Card>
        <button className="mz-btn primary" style={{ marginTop: 12 }} onClick={() => setSheet(true)}>
          Ouvrir une feuille
        </button>

        <div style={{ height: 20 }} />
      </MzScroll>

      <ActionBar onPlus={() => toast('＋ contextuel')} cta="Envoyer la mise à jour" onCta={() => setSheet(true)} />

      {sheet && (
        <Sheet title="Une feuille mz-" sub="Poignée, titre, sous-titre, options, boutons." onClose={() => setSheet(false)}>
          <button className="mz-opt" onClick={() => toast('Option')}>
            <span className="e">✍️</span>
            <span>
              <b>Saisie manuelle</b>
              <i>Toujours gratuit, toujours illimité</i>
            </span>
          </button>
          <button className="mz-opt" onClick={() => toast('Option IA')}>
            <span className="e" style={{ background: 'var(--mz-vioT)' }}>✦</span>
            <span>
              <b>Coup de main IA</b>
              <i>On structure pour vous</i>
            </span>
            <span className="quota">4 / 5</span>
          </button>
          <div className="mz-note">Chaque page arrive déjà remplie — vous ajustez, vous n'écrivez pas tout.</div>
          <div className="mz-btnrow">
            <button className="mz-btn" onClick={() => setSheet(false)}>Annuler</button>
            <button className="mz-btn primary" onClick={() => { setSheet(false); toast('Validé ✓'); }}>
              Valider
            </button>
          </div>
        </Sheet>
      )}

      {node}
    </MzScreen>
  );
}
