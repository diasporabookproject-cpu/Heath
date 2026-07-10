// Seed STAGING — jeu de données de test minimal + compte smoke par mot de passe (F2).
// Idempotent. Crée : 1 compte (email+password), son foyer, 2 recettes, 1 doc nounou,
// 1 espace publié à JETON CONNU (pour le test « lien public 200 anonyme » d'E3).
//
// ⚠️ STAGING UNIQUEMENT — refuse de tourner contre la prod (principe prod-read-only).
// Exécution (E2) : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SEED_SMOKE_PASSWORD en env.
//   npm run seed:staging
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.SEED_SMOKE_EMAIL || 'smoke@manzil.test';
const PASSWORD = process.env.SEED_SMOKE_PASSWORD;
const PROD_REF = 'pqeilsuqglmrvijndrwa';
export const SEED_ESPACE_TOKEN = 'seed-espace-public-001'; // jeton connu pour le test anonyme

if (!URL || !SVC) { console.error('✗ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis.'); process.exit(1); }
if (URL.includes(PROD_REF)) { console.error('✗ REFUS : URL = PROD. Le seed est staging-only (prod = lecture seule).'); process.exit(1); }
if (!PASSWORD) { console.error('✗ SEED_SMOKE_PASSWORD requis (compte smoke F2).'); process.exit(1); }

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const log = (m) => console.log('  ' + m);

// 1) Compte smoke (email + password), confirmé. Idempotent : réutilise s'il existe.
async function ensureUser() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (!error && created?.user) { log(`compte créé : ${EMAIL}`); return created.user.id; }
  // déjà existant → le retrouver
  const { data: list } = await admin.auth.admin.listUsers();
  const u = list?.users?.find((x) => x.email === EMAIL);
  if (!u) throw new Error('compte introuvable après createUser: ' + (error?.message ?? '?'));
  await admin.auth.admin.updateUserById(u.id, { password: PASSWORD, email_confirm: true });
  log(`compte réutilisé : ${EMAIL}`);
  return u.id;
}

// 2) Foyer + membre owner (idempotent via unique(user_id) sur membres).
async function ensureFoyer(uid) {
  const { data: mem } = await admin.from('membres').select('foyer_id').eq('user_id', uid).limit(1);
  if (mem?.[0]?.foyer_id) { log(`foyer existant : ${mem[0].foyer_id}`); return mem[0].foyer_id; }
  const { data: f, error: fe } = await admin.from('foyers').insert({ owner_user_id: uid }).select('id').single();
  if (fe) throw new Error('foyer: ' + fe.message);
  const { error: me } = await admin.from('membres').insert({ foyer_id: f.id, user_id: uid, role: 'owner' });
  if (me) throw new Error('membre: ' + me.message);
  log(`foyer créé : ${f.id}`);
  return f.id;
}

// 3) Docs (recettes + nounou), upsert par (foyer_id, store, doc_id).
async function seedDocs(foyerId) {
  const recipe = (id, nom, kcal, calcium, flag) => ({
    id, nom, role: 'plat', statut: 'valide',
    kcal, prot: 30, gluc: 40, lip: 15, calcium, flag_calcium: flag,
    ingredients: '200g poulet · 1 càs tahini · 100g brocoli',
    etapes: 'Cuire le poulet.\nAjouter le tahini.\nServir avec le brocoli.',
  });
  const docs = [
    { store: 'recipes', doc_id: 'seed-r1', payload: recipe('seed-r1', 'Poulet tahini brocoli', 520, 320, 'Champion') },
    { store: 'recipes', doc_id: 'seed-r2', payload: recipe('seed-r2', 'Sardines amandes', 480, 410, 'Champion') },
    { store: 'nounou', doc_id: 'doc', payload: { enfants: [{ id: 'seed-e1', prenom: 'Test' }], moments: [], periodes: [], ponctuels: [], numeros: [] } },
  ];
  for (const d of docs) {
    const { error } = await admin.from('docs').upsert(
      { foyer_id: foyerId, store: d.store, doc_id: d.doc_id, payload: d.payload },
      { onConflict: 'foyer_id,store,doc_id' },
    );
    if (error) throw new Error(`doc ${d.store}/${d.doc_id}: ${error.message}`);
  }
  log(`${docs.length} docs seedés (2 recettes + 1 nounou)`);
}

// 4) Espace publié à jeton connu (pour le test lien public 200 anonyme d'E3).
async function seedEspace(foyerId) {
  const payload = {
    kind: 'cuisine', v: 1, nom: 'Foyer de test',
    meals: [{ jour: 'Lundi', type: 'plat', nom: 'Poulet tahini brocoli', kcal: 520 }],
  };
  const { error } = await admin.from('espaces').upsert(
    { token: SEED_ESPACE_TOKEN, payload, foyer_id: foyerId, updated_at: new Date().toISOString() },
    { onConflict: 'token' },
  );
  if (error) throw new Error('espace: ' + error.message);
  log(`espace publié : token=${SEED_ESPACE_TOKEN} (lien public #e=${SEED_ESPACE_TOKEN})`);
}

console.log(`Seed staging → ${URL}`);
const uid = await ensureUser();
const foyerId = await ensureFoyer(uid);
await seedDocs(foyerId);
await seedEspace(foyerId);
console.log('✓ Seed terminé.');
