/**
 * Pulihkan dump JSON (hasil scripts/dump-supabase.cjs) ke Supabase.
 *
 * Usage:
 *   node scripts/restore-supabase.cjs                      # dry-run: bandingkan kiraan sahaja
 *   node scripts/restore-supabase.cjs --dir <folder-dump>  # dry-run folder lain
 *   node scripts/restore-supabase.cjs --allow-destructive --yes [--dir ...]
 *                                                          # PADAM + tulis semula
 *
 * Susunan sisipan mengikut kebergantungan FK (ibu bapa dahulu); pemadaman
 * songsang (anak dahulu). Batch 500 baris/permintaan, had 1000/pemadaman.
 * Keluar bukan-sifar jika mana-mana jadual gagal atau kiraan akhir berbeza.
 *
 * AMARAN: mod destructive memadam SEMUA data jadual berkaitan dahulu.
 * Ambil dump baharu sebelum menggunakannya. RLS dilangkau (service_role).
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Susunan SISIPAN (ibu bapa → anak).
const INSERT_ORDER = [
  "profiles",
  "item_categories",
  "item_forms",
  "supply_durations",
  "items",
  "item_batches",
  "patients",
  "staff_migration_lookup",
  "patient_item_assignments",
  "dose_history",
  "supply_records",
  "supply_declinations",
  "batch_adjustments",
  "batch_additions",
  "inventory_transactions",
  "password_reset_requests",
];
// Lajur PK untuk penapis pemadaman (semua kecuali yang dinyatakan = id UUID).
const PK = { staff_migration_lookup: "old_id" };
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

// Evolusi skema merentas migrasi: petakan nama lajur lama dalam dump kepada
// nama semasa sebelum sisipan. Tanpa ini, dump pra-045 gagal selepas 045
// (batch_additions.quantity → kuantiti).
const COLUMN_MAP = {
  batch_additions: { quantity: "kuantiti" },
};

function mapRow(table, row) {
  const mapping = COLUMN_MAP[table];
  if (!mapping) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[mapping[k] || k] = v;
  }
  return out;
}

const INSERT_BATCH = 500;
const DELETE_BATCH = 1000;

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2];
  }
  return out;
}

function latestDump(base) {
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("supabase-dump-"))
    .map((d) => d.name)
    .sort();
  if (dirs.length === 0) throw new Error(`Tiada dump dalam ${base}`);
  return path.join(base, dirs[dirs.length - 1]);
}

async function liveCount(supabase, table) {
  const pk = PK[table] || "id";
  const zero = pk === "old_id" ? -1 : ZERO_UUID;
  const { count, error } = await supabase
    .from(table)
    .select(pk, { count: "exact", head: true })
    .neq(pk, zero);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function wipeTable(supabase, table) {
  const pk = PK[table] || "id";
  const zero = pk === "old_id" ? -1 : ZERO_UUID;
  let total = 0;
  for (;;) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .neq(pk, zero)
      .limit(DELETE_BATCH);
    if (error) throw new Error(`${table}: ${error.message}`);
    total += count ?? 0;
    if (!count) break;
  }
  return total;
}

async function insertTable(supabase, table, rows) {
  const mapped = rows.map((r) => mapRow(table, r));
  for (let i = 0; i < mapped.length; i += INSERT_BATCH) {
    const chunk = mapped.slice(i, i + INSERT_BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`${table} [${i}-${i + chunk.length}]: ${error.message}`);
    if ((i / INSERT_BATCH) % 20 === 0 || i + chunk.length >= rows.length) {
      console.log(`  ... ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const destructive =
    args.has("--allow-destructive") && args.has("--yes");
  const dirIdx = process.argv.indexOf("--dir");
  const base = path.join(__dirname, "..", "backups");
  const dir =
    dirIdx >= 0 ? process.argv[dirIdx + 1] : latestDump(base);

  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`manifest.json tiada dalam ${dir}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const env = loadEnv(path.join(__dirname, "..", ".env"));
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tiada dalam .env");
    process.exit(1);
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Dump: ${dir} (${manifest.dumped_at})`);
  console.log(`Mod: ${destructive ? "DESTRUKTIF (padam + tulis semula)" : "DRY-RUN (lapor sahaja)"}\n`);

  // 1. Bandingkan kiraan dump vs live.
  let mismatch = 0;
  for (const t of INSERT_ORDER) {
    const dumpCount = manifest.tables[t]?.count ?? 0;
    let live = -1;
    try {
      live = await liveCount(supabase, t);
    } catch (e) {
      console.log(`? ${t}: dump=${dumpCount} live=? (${e.message})`);
      continue;
    }
    const mark = dumpCount === live ? "=" : "≠";
    if (dumpCount !== live) mismatch += 1;
    console.log(`${mark} ${t}: dump=${dumpCount} live=${live}`);
  }

  if (!destructive) {
    console.log(
      "\nDry-run sahaja — tiada tulisan. Untuk memulihkan, jalankan semula dengan --allow-destructive --yes (selepas dump baharu!)."
    );
    return;
  }

  // 2. Padam (anak dahulu).
  console.log("\nMemadam data sedia ada (anak dahulu)...");
  for (const t of [...INSERT_ORDER].reverse()) {
    if ((manifest.tables[t]?.count ?? 0) === 0) {
      console.log(`- ${t}: tiada dalam dump, dilangkau`);
      continue;
    }
    const n = await wipeTable(supabase, t);
    console.log(`- ${t}: ${n} baris dipadam`);
  }

  // 3. Tulis semula (ibu bapa dahulu).
  console.log("\nMenulis semula (ibu bapa dahulu)...");
  for (const t of INSERT_ORDER) {
    const file = path.join(dir, `${t}.json`);
    if (!fs.existsSync(file)) {
      console.log(`- ${t}: tiada fail, dilangkau`);
      continue;
    }
    const rows = JSON.parse(fs.readFileSync(file, "utf8"));
    if (rows.length === 0) {
      console.log(`- ${t}: 0 baris, dilangkau`);
      continue;
    }
    console.log(`- ${t}: ${rows.length} baris...`);
    await insertTable(supabase, t, rows);
  }
  // Nota: indeks unik 043/051 menolak baris pendua — itu dijangka jika
  // triage migrasi dilangkau; gabungkan dahulu, kemudian jalankan semula.

  // 4. Sahkan.
  console.log("\nPengesahan akhir:");
  let bad = 0;
  for (const t of INSERT_ORDER) {
    const expected = manifest.tables[t]?.count ?? 0;
    const live = await liveCount(supabase, t).catch(() => -1);
    const ok = expected === live;
    if (!ok) bad += 1;
    console.log(`${ok ? "OK " : "GAGAL"} ${t}: jangka=${expected} live=${live}`);
  }
  if (bad > 0) {
    console.error(`\n${bad} jadual TIDAK sepadan — siasat sebelum guna.`);
    process.exit(2);
  }
  console.log("\nPulih sepenuhnya — semua kiraan sepadan dengan manifest.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
