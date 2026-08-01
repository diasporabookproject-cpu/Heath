import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * 🔴 LA GARDE QUI TIENT LA RÈGLE D'OUVERTURE DE LOT (audit du 31/07, mesure 5).
 *
 * L'incident du lot Identité : la branche de travail était **aussi** la branche qui
 * publie, et le lot est parti en prod cinq jours avant son GO. Trois lots avant lui
 * avaient survécu parce que chaque session repointait les workflows à la main — donc
 * la protection reposait sur une **habitude**. Le quatrième a lâché.
 *
 * *Une règle qui repose sur la vigilance meurt ; une règle portée par une porte
 * survit.* Ce fichier est la porte : il lit les workflows et échoue, en CI comme en
 * local, quand le pointage ne correspond pas à ce qu'on est en train de faire.
 *
 * Ce qu'il NE peut pas faire : empêcher un déploiement manuel (`workflow_dispatch`)
 * ni la publication depuis la branche de prod elle-même — ça se ferme côté réglages
 * du dépôt (environnement protégé avec approbation).
 */

const WORKFLOWS = ['.github/workflows/deploy.yml', '.github/workflows/apk.yml'] as const;

/** Les branches du déclencheur `push` d'un workflow (forme `branches: [a, b]`). */
function branchesDeclencheuses(fichier: string): string[] {
  const yml = readFileSync(fichier, 'utf8');
  const m = yml.match(/^\s*branches:\s*\[([^\]]*)\]/m);
  if (!m) throw new Error(`${fichier} : aucun déclencheur \`branches: [...]\` trouvé`);
  return m[1]
    .split(',')
    .map((b) => b.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** La branche courante — `GITHUB_REF_NAME` en CI, sinon git. `null` si indéterminable. */
function brancheCourante(): string | null {
  const ci = process.env.GITHUB_REF_NAME;
  if (ci) return ci;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim() || null;
  } catch {
    return null; // pas un dépôt git (archive, sandbox) → on ne bloque pas
  }
}

/**
 * Le lot est-il EN VOL ? Un lot en vol porte du travail que la branche visée par les
 * workflows n'a pas encore. Une fois le lot clos, sa branche est contenue dans la
 * prod — elle ne demande plus rien. (Première écriture de ce test : il exigeait le
 * repointage sur toute branche `lot-*`, donc il restait rouge après la clôture. Le
 * nom de la branche ne dit pas si le lot vit ; l'écart de commits, oui.)
 *
 * `null` = indéterminable (réf absente en CI avec `fetch-depth: 1`, pas de git) →
 * on n'exige rien : cette porte est d'abord une garde LOCALE.
 */
function lotEnVol(cible: string): boolean | null {
  try {
    execSync(`git rev-parse --verify --quiet ${cible} || git rev-parse --verify --quiet origin/${cible}`, {
      stdio: 'pipe',
    });
  } catch {
    return null; // la branche visée n'existe pas ici → rien à comparer
  }
  try {
    // exit 0 ⇒ HEAD est déjà contenu dans la cible ⇒ lot clos.
    execSync(`git merge-base --is-ancestor HEAD ${cible} 2>/dev/null || git merge-base --is-ancestor HEAD origin/${cible}`, {
      stdio: 'pipe',
    });
    return false;
  } catch {
    return true; // du travail hors de la cible ⇒ lot en vol
  }
}

describe('portes de déploiement — le pointage des workflows', () => {
  it('chaque workflow ne déclenche que sur UNE branche', () => {
    for (const f of WORKFLOWS) {
      expect(branchesDeclencheuses(f), `${f} doit lister exactement une branche`).toHaveLength(1);
    }
  });

  it('les deux workflows visent LA MÊME branche', () => {
    // Le vrai piège observé à la clôture du lot Identité : `apk.yml` pointait encore
    // sur la branche de lot alors que `deploy.yml` pointait la prod. Les deux doivent
    // toujours suivre le même cap, sinon l'un des deux est oublié.
    const [deploy, apk] = WORKFLOWS.map((f) => branchesDeclencheuses(f)[0]);
    expect(apk, 'apk.yml et deploy.yml doivent viser la même branche').toBe(deploy);
  });

  it('un lot EN VOL doit avoir les workflows pointés sur SA branche (la prod reste figée)', () => {
    const branche = brancheCourante();
    if (!branche || !/^lot-/.test(branche)) return; // hors branche de lot : rien à exiger
    const cible = branchesDeclencheuses(WORKFLOWS[0])[0];
    if (cible === branche) return; // déjà repointé : c'est l'état attendu pendant un lot
    if (lotEnVol(cible) !== true) return; // lot clos (ou comparaison impossible) : rien à exiger
    for (const f of WORKFLOWS) {
      expect(
        branchesDeclencheuses(f)[0],
        `${f} vise « ${cible} » alors qu'un lot est EN VOL sur « ${branche} » : ` +
          'repointez les DEUX workflows sur la branche de lot au premier geste du lot — ' +
          'sinon chaque push publie en prod avant le GO (incident du lot Identité, 26/07).',
      ).toBe(branche);
    }
  });

  it('la porte de déploiement passe par les portes PARTAGÉES (smokes inclus)', () => {
    // Régression gardée : `deploy.yml` a longtemps porté sa propre copie réduite
    // (`typecheck` + `test`), sans les parcours. Si quelqu'un la réintroduit, ce test
    // tombe. Et `ci.yml` doit appeler la même définition, sinon la dérive revient.
    const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(deploy).toContain('uses: ./.github/workflows/portes.yml');
    expect(ci).toContain('uses: ./.github/workflows/portes.yml');
    // …et les portes partagées lancent bien les TROIS smokes.
    const portes = readFileSync('.github/workflows/portes.yml', 'utf8');
    for (const s of ['npm run smoke', 'scripts/smoke-comptes.mjs', 'scripts/smoke-ftue.mjs']) {
      expect(portes, `les portes partagées doivent lancer ${s}`).toContain(s);
    }
  });
});
