import { describe, expect, it } from 'vitest';
import { doitPurgerPourNouveauCompte } from './compte';

// Correctif device ① — « le contenu ne doit être accessible qu'avec SON compte ».
describe('changement de compte sur un appareil', () => {
  it('un AUTRE compte se connecte → on vide la copie locale', () => {
    expect(doitPurgerPourNouveauCompte('user-A', 'user-B')).toBe(true);
  });

  it('le MÊME compte revient (déconnexion → reconnexion) → on garde', () => {
    // Purger ici détruirait des modifications hors-ligne non poussées, sans rien
    // protéger : personne d'autre n'a vu l'écran entre les deux (le mur était là).
    expect(doitPurgerPourNouveauCompte('user-A', 'user-A')).toBe(false);
  });

  it('tout premier compte → on garde (les données rejoignent le foyer fondé)', () => {
    expect(doitPurgerPourNouveauCompte(null, 'user-A')).toBe(false);
  });

  it('identifiant manquant → on ne purge jamais sur un doute', () => {
    expect(doitPurgerPourNouveauCompte('user-A', '')).toBe(false);
  });
});
