/**
 * Migration Script: SRQ.db3 (SQLite) → Supabase
 *
 * Usage: node _migrate_sqlite_to_supabase.cjs
 *
 * Prerequisites:
 *   1. .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   2. SRQ.db3 in project root
 *   3. Apply supabase/migrations/014_user_theme_preference.sql first
 *   4. Dependencies: better-sqlite3 @supabase/supabase-js bcryptjs
 *
 * What this does:
 *   - Clears ALL data from Supabase
 *   - Migrates all data from SRQ.db3
 *   - Sets default password "password123" (bcrypt) for all staff
 *   - Sets Fetre as Pentadbir with password "972233"
 *   - Sets default username = cleaned staff name
 *   - Creates one fallback batch per item with kuantiti=1000 and expiry 2027-12-31
 *   - Preserves all relationships
 */

const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  process.env[key] = val;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQLITE_PATH = path.join(__dirname, 'SRQ.db3');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 500;
const FALLBACK_BATCH_QUANTITY = 1000;
const FALLBACK_BATCH_EXPIRY = '2027-12-31';
const ADMIN_NAME = 'fetre';
const ADMIN_PASSWORD = '972233';
const DEFAULT_PASSWORD = 'password123';
const DEFAULT_THEME = 'light';
const MIGRATION_TIMESTAMP = new Date().toISOString();

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function makeUsername(nama) {
  return nama.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 63) || 'user';
}

function toKLStartISO(value) {
  if (!value) return null;
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00+08:00` : null;
}

function makeLookupId(prefix, oldId) {
  const suffix = Number(oldId).toString(16).padStart(12, '0').slice(-12);
  return `${prefix}0000000-0000-0000-0000-${suffix}`;
}

async function insertBatched(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`Insert into ${table}: ${error.message}`);
    process.stdout.write(`\r    ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  console.log('');
}

async function deleteAllFrom(table, pkColumn = 'id') {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await supabase.from(table).delete().neq(pkColumn, '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Delete ${table}: ${error.message}`);
    const { data, error: checkErr } = await supabase.from(table).select(pkColumn).limit(1);
    if (checkErr) throw new Error(`Check ${table}: ${checkErr.message}`);
    if (!data || data.length === 0) return;
    console.log(`  ⚠️  ${table}: retrying delete (rows remaining)...`);
  }
  console.log(`  ⚠️  ${table}: could not verify all rows deleted (proceeding)`);
}

// staff_migration_lookup has old_id as PK, not id
async function deleteAllFromStaffLookup() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await supabase.from('staff_migration_lookup').delete().neq('old_id', 0);
    if (error) throw new Error(`Delete staff_migration_lookup: ${error.message}`);
    const { data, error: checkErr } = await supabase.from('staff_migration_lookup').select('old_id').limit(1);
    if (checkErr) throw new Error(`Check staff_migration_lookup: ${checkErr.message}`);
    if (!data || data.length === 0) return;
    console.log(`  ⚠️  staff_migration_lookup: retrying delete (rows remaining)...`);
  }
  console.log(`  ⚠️  staff_migration_lookup: could not verify all rows deleted (proceeding)`);
}

// ── Migration ─────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\n=== SQLite to Supabase Migration ===\n');

  const PASSWORD_HASH = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const ADMIN_PASSWORD_HASH = await bcrypt.hash(ADMIN_PASSWORD, 10);
  console.log(`Default password hash generated for "${DEFAULT_PASSWORD}"\n`);

  // ── Step 1: Truncate all tables ──
  console.log('Step 1: Clearing Supabase data...');
  const truncateOrder = [
    'inventory_transactions',
    'batch_additions',
    'batch_adjustments',
    'dose_history',
    'supply_records',
    'patient_item_assignments',
    'item_batches',
    'items',
    'staff_migration_lookup',
    'password_reset_requests',
    'patients',
    'profiles',
    'supply_durations',
    'item_forms',
    'item_categories',
  ];
  for (const t of truncateOrder) {
    process.stdout.write(`  ${t}... `);
    if (t === 'staff_migration_lookup') {
      await deleteAllFromStaffLookup();
    } else {
      await deleteAllFrom(t);
    }
    console.log('OK');
  }
  console.log('  All tables cleared.\n');

  // ── Step 2: Lookup tables ──
  console.log('Step 2: Lookup tables...');

  const rawCats = sqlite.prepare('SELECT * FROM tblSenaraiKategoriUbat ORDER BY ID').all();
  const categoryMap = new Map(rawCats.map(c => [c.ID, makeLookupId('a', c.ID)]));
  const catRows = rawCats.map(c => ({ id: categoryMap.get(c.ID), nama: c.Kategori_Ubat }));
  const { error: catErr } = await supabase.from('item_categories').insert(catRows);
  if (catErr) throw catErr;
  console.log(`  item_categories: ${catRows.length} rows`);

  const rawForms = sqlite.prepare('SELECT * FROM tblSenaraiBentukDos ORDER BY ID').all();
  const formMap = new Map(rawForms.map(f => [f.ID, makeLookupId('b', f.ID)]));
  const formRows = rawForms.map(f => ({ id: formMap.get(f.ID), nama: f.Bentuk_Dos }));
  const { error: formErr } = await supabase.from('item_forms').insert(formRows);
  if (formErr) throw formErr;
  console.log(`  item_forms: ${formRows.length} rows`);

  const rawDurs = sqlite.prepare('SELECT * FROM tblSenaraiDurasiBekalan ORDER BY ID').all();
  const durationMap = new Map(rawDurs.map(d => [d.ID, makeLookupId('c', d.ID)]));
  const durRows = rawDurs.map(d => ({ id: durationMap.get(d.ID), nama: d.Durasi_Bekalan }));
  const { error: durErr } = await supabase.from('supply_durations').insert(durRows);
  if (durErr) throw durErr;
  console.log(`  supply_durations: ${durRows.length} rows\n`);

  // ── Step 3: Profiles ──
  console.log('Step 3: Profiles...');
  const staffList = sqlite.prepare('SELECT * FROM tblKakitangan ORDER BY ID').all();
  const adminStaff = staffList.find(s => String(s.Nama || '').trim().toLowerCase() === ADMIN_NAME);
  if (!adminStaff) throw new Error(`Admin staff "${ADMIN_NAME}" was not found in SRQ.db3`);
  const profileMap = new Map();
  const usernameCount = new Map();
  const profileRows = staffList.map(s => {
    const id = uuidv4();
    profileMap.set(s.ID, id);
    const isAdmin = s.ID === adminStaff.ID;
    const base = isAdmin ? ADMIN_NAME : makeUsername(s.Nama);
    const count = (usernameCount.get(base) || 0) + 1;
    usernameCount.set(base, count);
    const nama_pengguna = count > 1 ? `${base}${count}` : base;
    return {
      id,
      nama: s.Nama,
      jawatan: null,
      nama_pengguna: isAdmin ? ADMIN_NAME : nama_pengguna,
      peranan: isAdmin ? 'Pentadbir' : 'Kakitangan Farmasi',
      aktif: Boolean(s.Aktif),
      kata_laluan_hash: isAdmin ? ADMIN_PASSWORD_HASH : PASSWORD_HASH,
      tema: DEFAULT_THEME,
    };
  });
  await insertBatched('profiles', profileRows);
  console.log(`  profiles: ${profileRows.length} rows`);
  const adminProfileId = profileMap.get(adminStaff.ID);

  const smlRows = staffList.map(s => ({
    old_id: s.ID,
    profile_id: profileMap.get(s.ID),
  }));
  const { error: smlErr } = await supabase.from('staff_migration_lookup').insert(smlRows);
  if (smlErr) throw smlErr;
  console.log(`  staff_migration_lookup: ${smlRows.length} rows\n`);

  // ── Step 4: Items ──
  console.log('Step 4: Items...');
  const itemsList = sqlite.prepare('SELECT * FROM tblSenaraiUbat ORDER BY ID').all();
  const itemMap = new Map();
  const itemRows = itemsList.map(item => {
    const id = uuidv4();
    itemMap.set(item.ID, id);
    return {
      id,
      kod_item: `ITEM-${String(item.ID).padStart(4, '0')}`,
      nama_item: item.Nama,
      nama_dagangan: item.Nama_Dagangan || null,
      kekuatan: item.Kekuatan || null,
       id_kategori: item.ID_Kategori ? categoryMap.get(item.ID_Kategori) ?? null : null,
       id_bentuk: item.ID_Bentuk ? formMap.get(item.ID_Bentuk) ?? null : null,
      kuota: item.Kuota ?? 0,
      catatan: item.Catatan || null,
      aktif: Boolean(item.Aktif),
    };
  });
  await insertBatched('items', itemRows);
  console.log(`  items: ${itemRows.length} rows\n`);

  // ── Step 5: Item Batches ──
  // SRQ.db3 has no batch table, so these are documented fallback opening batches.
  console.log(`Step 5: Item batches (kuantiti=${FALLBACK_BATCH_QUANTITY}, luput=${FALLBACK_BATCH_EXPIRY})...`);
  const batchMap = new Map();
  const batchRows = itemsList.map(item => {
    const id = uuidv4();
    batchMap.set(item.ID, id);
    return {
      id,
      item_id: itemMap.get(item.ID),
      nombor_kelompok: `LEGACY-${String(item.ID).padStart(4, '0')}`,
       tarikh_luput: FALLBACK_BATCH_EXPIRY,
       kuantiti: FALLBACK_BATCH_QUANTITY,
       dilupuskan: false,
       dilupuskan_at: null,
       created_at: MIGRATION_TIMESTAMP,
     };
  });
  await insertBatched('item_batches', batchRows);
  const batchAdditionRows = batchRows.map(batch => ({
    batch_id: batch.id,
    quantity: FALLBACK_BATCH_QUANTITY,
    added_by: adminProfileId,
    created_at: MIGRATION_TIMESTAMP,
  }));
  await insertBatched('batch_additions', batchAdditionRows);
  const batchAdjustmentRows = batchRows.map(batch => ({
    batch_id: batch.id,
    previous_kuantiti: 0,
    new_kuantiti: FALLBACK_BATCH_QUANTITY,
    change: FALLBACK_BATCH_QUANTITY,
    reason: 'Stok awal migrasi SRQ.db3',
    adjusted_by: adminProfileId,
    created_at: MIGRATION_TIMESTAMP,
  }));
  await insertBatched('batch_adjustments', batchAdjustmentRows);
  const initialInventoryRows = batchRows.map(batch => ({
    item_id: batch.item_id,
    batch_id: batch.id,
    jenis: 'masuk',
    kuantiti: FALLBACK_BATCH_QUANTITY,
    rujukan_id: batch.id,
    rujukan_type: 'migration_initial_stock',
    catatan: 'Stok awal migrasi SRQ.db3',
    created_at: MIGRATION_TIMESTAMP,
  }));
  await insertBatched('inventory_transactions', initialInventoryRows);
  console.log(`  item_batches: ${batchRows.length} rows`);
  console.log(`  batch_additions: ${batchAdditionRows.length} rows`);
  console.log(`  batch_adjustments: ${batchAdjustmentRows.length} rows`);
  console.log(`  inventory_transactions (initial): ${initialInventoryRows.length} rows\n`);

  // ── Step 6: Patients ──
  console.log('Step 6: Patients...');
  const patientList = sqlite.prepare('SELECT * FROM tblPesakit ORDER BY ID').all();
  const patientMap = new Map();
  const patientRows = patientList.map(p => {
    const id = uuidv4();
    patientMap.set(p.ID, id);
    return {
      id,
      nama: p.Nama,
      nombor_kad_pengenalan: p.Kad_Pengenalan || null,
      nombor_pendaftaran_hospital: p.Nombor_Pendaftaran || null,
      dokumen_lain: p.Dokumen_Lain || null,
      nombor_telefon: p.Nombor_Telefon || null,
      alamat: p.Alamat || null,
      catatan: null,
      aktif: Boolean(p.Aktif),
      tarikh_daftar: p.Tarikh_Daftar || null,
    };
  });
  await insertBatched('patients', patientRows);
  console.log(`  patients: ${patientRows.length} rows\n`);

  // ── Step 7: Patient Item Assignments ──
  console.log('Step 7: Patient item assignments...');
  const assignments = sqlite.prepare('SELECT * FROM tblRekodPenggunaanUbat ORDER BY ID').all();
  const doses = sqlite.prepare('SELECT * FROM tblDos ORDER BY ID').all();
  const latestDoseMap = new Map();
  for (const dose of doses) {
    const previous = latestDoseMap.get(dose.ID_Penggunaan_Ubat);
    const doseKey = `${dose.Tarikh || ''}|${String(dose.ID || '').padStart(12, '0')}`;
    const previousKey = previous ? `${previous.Tarikh || ''}|${String(previous.ID || '').padStart(12, '0')}` : '';
    if (!previous || doseKey > previousKey) latestDoseMap.set(dose.ID_Penggunaan_Ubat, dose);
  }
  const assignmentMap = new Map();
  const assignmentRows = assignments.map(a => {
    const id = uuidv4();
    assignmentMap.set(a.ID, id);
    return {
      id,
      patient_id: patientMap.get(a.ID_Pesakit),
      item_id: itemMap.get(a.ID_Ubat),
       dos: latestDoseMap.get(a.ID)?.Dos || null,
      tarikh_mula_guna: a.Tarikh_Mula,
       // SRQ.db3 has no staff column for assignment creation.
       dimulakan_oleh: null,
      tarikh_tamat_guna: a.Tarikh_Tamat || null,
      ditamatkan_oleh: a.ID_Kakitangan_Henti ? profileMap.get(a.ID_Kakitangan_Henti) : null,
       // SRQ.db3 has no assignment-recording staff column.
       kakitangan_farmasi_perekod: null,
      aktif: Boolean(a.Aktif),
      sebab_tamat: a.Sebab_Tamat || null,
      catatan_penggunaan: a.Catatan_Penggunaan || null,
    };
  });
  await insertBatched('patient_item_assignments', assignmentRows);
  console.log(`  patient_item_assignments: ${assignmentRows.length} rows\n`);

  // ── Step 8: Supply Records ──
  console.log('Step 8: Supply records...');
  // Pre-map assignment ID -> item old ID for batch lookup
  const assItemMap = new Map();
  for (const a of assignments) {
    assItemMap.set(a.ID, a.ID_Ubat);
  }
  const allSupplies = sqlite.prepare('SELECT * FROM tblRekodBekalan ORDER BY ID').all();
  const supplies = allSupplies.filter(s => Number(s.Kuantiti) > 0);
  const skippedInvalidSupplyCount = allSupplies.length - supplies.length;
  if (skippedInvalidSupplyCount > 0) {
    console.warn(`  Skipping ${skippedInvalidSupplyCount} legacy supply rows with kuantiti <= 0 (target requires kuantiti > 0).`);
  }
  const supplyMap = new Map();
  const supplyRows = supplies.map(s => {
    const itemOldId = assItemMap.get(s.ID_Penggunaan_Ubat);
    const id = uuidv4();
    supplyMap.set(s.ID, id);
    return {
       id,
       assignment_id: assignmentMap.get(s.ID_Penggunaan_Ubat),
       tarikh_dibekal: toKLStartISO(s.Tarikh) || MIGRATION_TIMESTAMP,
      dos: s.Dos || '',
      tempoh_dibekal: s.Durasi_Bekalan || null,
      kuantiti: s.Kuantiti,
      batch_id: itemOldId ? batchMap.get(itemOldId) : null,
       kakitangan_pembekal: profileMap.get(s.ID_Kakitangan),
       catatan_bekalan: s.Catatan_Bekalan || null,
       created_at: toKLStartISO(s.Tarikh) || MIGRATION_TIMESTAMP,
     };
  });
  await insertBatched('supply_records', supplyRows);
  const supplyInventoryRows = supplies.map(s => ({
    item_id: itemMap.get(assItemMap.get(s.ID_Penggunaan_Ubat)),
    batch_id: batchMap.get(assItemMap.get(s.ID_Penggunaan_Ubat)),
    jenis: 'keluar',
    kuantiti: s.Kuantiti,
    rujukan_id: supplyMap.get(s.ID),
    rujukan_type: 'supply',
    catatan: s.Catatan_Bekalan || null,
    created_at: toKLStartISO(s.Tarikh) || MIGRATION_TIMESTAMP,
  }));
  await insertBatched('inventory_transactions', supplyInventoryRows);
  console.log(`  supply_records: ${supplyRows.length} rows`);
  console.log(`  inventory_transactions (supplies): ${supplyInventoryRows.length} rows\n`);

  // ── Step 9: Dose History ──
  console.log('Step 9: Dose history...');
  const doseRows = doses.map(d => ({
    id: uuidv4(),
    assignment_id: assignmentMap.get(d.ID_Penggunaan_Ubat),
    tarikh: d.Tarikh,
    dos: d.Dos,
    aktif: Boolean(d.Aktif),
    catatan: d.Catatan || null,
    dikemaskini_oleh: null,
  }));
  await insertBatched('dose_history', doseRows);
  console.log(`  dose_history: ${doseRows.length} rows\n`);

  // ── Summary ──
  console.log('=== Migration Complete ===\n');
  console.log(`  Profiles:             ${profileRows.length}`);
  console.log(`  Items:                ${itemRows.length}`);
  console.log(`  Item Batches (${FALLBACK_BATCH_QUANTITY}, ${FALLBACK_BATCH_EXPIRY}): ${batchRows.length}`);
  console.log(`  Batch Additions:      ${batchAdditionRows.length}`);
  console.log(`  Batch Adjustments:    ${batchAdjustmentRows.length}`);
  console.log(`  Patients:             ${patientRows.length}`);
  console.log(`  Assignments:          ${assignmentRows.length}`);
  console.log(`  Supply Records:       ${supplyRows.length}`);
  console.log(`  Skipped invalid supplies: ${skippedInvalidSupplyCount}`);
  console.log(`  Dose History:         ${doseRows.length}`);
  console.log('');
  console.log(`  Default password for all users: ${DEFAULT_PASSWORD}`);
  console.log(`  Admin user: ${ADMIN_NAME} / ${ADMIN_PASSWORD}`);
  console.log('  Username set to sanitized staff name');
  console.log(`  All item quantities initialized to ${FALLBACK_BATCH_QUANTITY}\n`);

  sqlite.close();
}

migrate().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
