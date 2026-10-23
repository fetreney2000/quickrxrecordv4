/**
 * Dump keseluruhan pangkalan data Supabase ke JSON tempatan (backup pra-migrasi).
 *
 * Usage: node scripts/dump-supabase.cjs [--out backups]
 *
 * Membaca SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY daripada .env (tidak
 * sekali-kali mencetaknya). Mengeksport setiap jadual sebagai
 * <jadual>.json (array penuh) + manifest.json (bilangan baris, masa).
 * Paginasi 1000 baris (had PostgREST) mengikut tertib id (stabil).
 * Direktori output diabaikan git (lihat .gitignore → backups/).
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const TABLES = [
  "profiles",
  "items",
  "item_batches",
  "patients",
  "patient_item_assignments",
  "supply_records",
  "dose_history",
  "supply_declinations",
  "batch_additions",
  "batch_adjustments",
  "inventory_transactions",
  "item_categories",
  "item_forms",
  "supply_durations",
  "password_reset_requests",
  "auth_attempts",
  "staff_migration_lookup",
];

const PAGE_SIZE = 1000;

// Lajur tertib setiap jadual (semua PK kecuali yang dinyatakan).
const ORDER_BY = {
  staff_migration_lookup: "old_id",
};

// Jadual yang dijangka tiada jika migrasi berkaitan belum digunakan —
// dilangkau (dilapor) dan bukannya digagalkan.
const OPTIONAL_TABLES = new Set([
  "auth_attempts", // wujud selepas migrasi 039
]);

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2];
  }
  return out;
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

async function dumpTable(supabase, table) {
  const orderCol = ORDER_BY[table] || "id";
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderCol, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      const msg = String(error.message || error);
      if (OPTIONAL_TABLES.has(table) && /Could not find the table/i.test(msg)) {
        return { skipped: true, reason: "jadual belum wujud (migrasi belum digunakan)" };
      }
      throw new Error(`${table}: ${msg}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows };
}

async function main() {
  const outBase =
    process.argv.includes("--out")
      ? process.argv[process.argv.indexOf("--out") + 1]
      : "backups";
  const env = loadEnv(path.join(__dirname, "..", ".env"));
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tiada dalam .env");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dir = path.join(__dirname, "..", outBase, `supabase-dump-${stamp()}`);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = { dumped_at: new Date().toISOString(), tables: {} };
  let failed = 0;
  for (const t of TABLES) {
    try {
      const result = await dumpTable(supabase, t);
      if (result.skipped) {
        manifest.tables[t] = { count: 0, skipped: true, reason: result.reason };
        console.log(`LANGKAU ${t}: ${result.reason}`);
        continue;
      }
      fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(result.rows));
      manifest.tables[t] = { count: result.rows.length, file: `${t}.json` };
      console.log(`OK  ${t}: ${result.rows.length} baris`);
    } catch (e) {
      failed += 1;
      manifest.tables[t] = { count: -1, error: String(e.message || e) };
      console.error(`GAGAL ${t}: ${e.message}`);
    }
  }
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`\nSiap: ${dir}`);
  console.log(
    `Jumlah baris: ${Object.values(manifest.tables).reduce((s, t) => s + Math.max(0, t.count), 0)}`
  );
  if (failed > 0) {
    console.error(`${failed} jadual GAGAL — semak manifest.json`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
