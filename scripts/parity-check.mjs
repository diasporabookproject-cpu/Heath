// parity:check — prouve que STAGING == PROD sur la STRUCTURE (hors données).
// Lot « Environnements propres » — E3. Compare des requêtes catalogue normalisées,
// TEXTE-À-TEXTE. PROD EN LECTURE SEULE (aucune écriture, deux SELECT).
//
// Le périmètre inclut VOLONTAIREMENT les `proacl` des fonctions → le diff prouve le
// HOTFIX A1 (RPC quota = service_role only), pas seulement la forme.
//
// Usage (token à l'exécution, JAMAIS en CI) :
//   SUPABASE_PAT=sbp_... npm run parity:check
// Sortie : PASS par aspect, ou les écarts. Exit 1 si écart non attendu.
// Les tables *_bak (cruft prod, à dropper en Fiche 3) sont classées « attendu ».

const PAT = process.env.SUPABASE_PAT;
const STAGING = process.env.STAGING_REF || 'tryjcednzencepokodrs';
const PROD = process.env.PROD_REF || 'pqeilsuqglmrvijndrwa';
if (!PAT) { console.error('✗ SUPABASE_PAT requis (token jetable, révoqué après).'); process.exit(1); }

// Un écart est « attendu » (non bloquant) s'il concerne le cruft *_bak.
const EXPECTED = (line) => /bak_2026/.test(line);

// Chaque aspect = 1 requête renvoyant une colonne `line` normalisée + ordonnée.
const ASPECTS = {
  'tables+colonnes': `select table_name||'.'||column_name||' :: '||data_type||' null='||is_nullable||' def='||coalesce(column_default,'') as line
    from information_schema.columns where table_schema='public' order by 1;`,
  'policies (public+storage)': `select schemaname||'.'||tablename||'.'||policyname||' | '||cmd||' | '||array_to_string(roles,',')||' | using='||coalesce(qual,'')||' | check='||coalesce(with_check,'') as line
    from pg_policies where schemaname in ('public','storage') order by 1;`,
  'fonctions + proacl (preuve A1)': `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||') secdef='||p.prosecdef||' lang='||l.lanname||' acl='||coalesce(array_to_string(p.proacl,';'),'DEFAULT_PUBLIC') as line
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' order by 1;`,
  'triggers': `select event_object_table||'.'||trigger_name||' '||action_timing||' '||event_manipulation as line
    from information_schema.triggers where trigger_schema='public' order by 1;`,
  'rls': `select relname||' rls='||relrowsecurity as line from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' order by 1;`,
  'index': `select tablename||'.'||indexname as line from pg_indexes where schemaname='public' order by 1;`,
  'buckets': `select id||' public='||public as line from storage.buckets order by 1;`,
};

async function runSql(ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${ref}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).map((r) => r.line);
}

async function fetchFns(ref) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, {
    headers: { Authorization: `Bearer ${PAT}` },
  });
  if (!res.ok) throw new Error(`functions ${ref}: HTTP ${res.status}`);
  const a = await res.json();
  return Object.fromEntries(a.map((f) => [f.slug, f.verify_jwt])); // slug → verify_jwt (on ignore le n° de version)
}

function diffLines(sLines, pLines) {
  const s = new Set(sLines), p = new Set(pLines);
  const prodOnly = [...p].filter((x) => !s.has(x));
  const stagingOnly = [...s].filter((x) => !p.has(x));
  return { prodOnly, stagingOnly };
}

let failures = 0, expectedCount = 0;
console.log(`parity:check — staging(${STAGING}) vs prod(${PROD}) — PROD EN LECTURE SEULE\n`);

for (const [name, sql] of Object.entries(ASPECTS)) {
  const [sLines, pLines] = await Promise.all([runSql(STAGING, sql), runSql(PROD, sql)]);
  const { prodOnly, stagingOnly } = diffLines(sLines, pLines);
  const realProdOnly = prodOnly.filter((l) => !EXPECTED(l));
  const expProdOnly = prodOnly.filter(EXPECTED);
  expectedCount += expProdOnly.length;
  if (!realProdOnly.length && !stagingOnly.length) {
    console.log(`✓ ${name} — identique (staging:${sLines.length} prod:${pLines.length})` + (expProdOnly.length ? `  [${expProdOnly.length} *_bak attendus ignorés]` : ''));
  } else {
    failures += realProdOnly.length + stagingOnly.length;
    console.log(`✗ ${name} — ÉCART`);
    realProdOnly.forEach((l) => console.log(`    PROD-ONLY:    ${l}`));
    stagingOnly.forEach((l) => console.log(`    STAGING-ONLY: ${l}`));
    if (expProdOnly.length) console.log(`    (+${expProdOnly.length} *_bak attendus, ignorés)`);
  }
}

// Edge functions : slugs présents + verify_jwt (on ignore les numéros de version).
const [sf, pf] = await Promise.all([fetchFns(STAGING), fetchFns(PROD)]);
const allSlugs = [...new Set([...Object.keys(sf), ...Object.keys(pf)])].sort();
let fnFail = 0;
for (const slug of allSlugs) {
  if (!(slug in sf)) { console.log(`✗ edge fn — PROD-ONLY: ${slug}`); fnFail++; }
  else if (!(slug in pf)) { console.log(`✗ edge fn — STAGING-ONLY: ${slug}`); fnFail++; }
  else if (sf[slug] !== pf[slug]) { console.log(`✗ edge fn ${slug} — verify_jwt staging=${sf[slug]} prod=${pf[slug]}`); fnFail++; }
}
console.log(fnFail ? `✗ edge functions — ${fnFail} écart(s)` : `✓ edge functions — ${allSlugs.length} slugs alignés (verify_jwt conformes)`);
failures += fnFail;

console.log(`\n${failures ? '✗' : '✓'} PARITÉ : ${failures} écart(s) non attendu(s)` + (expectedCount ? ` · ${expectedCount} *_bak attendus (drop en Fiche 3)` : ''));
process.exit(failures ? 1 : 0);
