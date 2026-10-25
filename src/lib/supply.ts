/**
 * Logik bekalan pelbagai kelompok (FEFO) — dikongsi oleh QuickDispense dan
 * PatientDetail (sebelum ini tersalin dua kali dan berbeza tingkah laku).
 *
 * Matlamat keselamatan audit C6:
 *   - Ralat perniagaan (stok tidak mencukupi, dll.) TIDAK PERNAH masuk ke
 *     laluan fallback — hanya "RPC belum deployed" (42883/PGRST202)
 *   - Semua tulisan menyemak ralatnya (item_batches, supply_records,
 *     inventory_transactions)
 *   - Kegagalan pertengahan mengimbangi (compensate) baris yang telah ditulis
 */
import { supabase } from "@/lib/supabase";
import { uuid } from "@/lib/utils";

export interface SupplyAllocation {
  batchId: string;
  kuantiti: number;
}

export interface SupplyMultiInput {
  assignmentId: string;
  itemId: string;
  dos: string;
  kuantiti: number;
  tempoh: string;
  catatan: string;
  allocations: SupplyAllocation[];
}

export interface SupplyMultiResult {
  success: boolean;
  id: string | null;
}

/** Ralat PostgREST/Postgres bermaksud "fungsi tiada" (bukan ralat perniagaan). */
export function isRpcMissing(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42883" || e.code === "PGRST202") return true;
  const msg = e.message ?? "";
  return /could not find the function|function .*does not exist/i.test(msg);
}

interface AppliedWrite {
  supplyId: string;
  batchId: string;
  qty: number;
}

/**
 * Imbau balik tulisan fallback secara best-effort:
 * padam jurnal → padam supply_records → kembalikan kuantiti kelompok.
 * Gagal mana-mana langkah direkodkan ke console (pemanggil masih melempar
 * ralat asal dengan amaran stok mungkin perlu disemak).
 */
async function compensate(applied: AppliedWrite[]): Promise<boolean> {
  if (applied.length === 0) return true;
  let clean = true;
  const supplyIds = applied.map((a) => a.supplyId);

  const { error: txErr } = await supabase
    .from("inventory_transactions")
    .delete()
    .in("rujukan_id", supplyIds)
    .eq("rujukan_type", "supply");
  if (txErr) {
    clean = false;
    console.error("[supply] compensate: gagal padam jurnal", txErr);
  }

  const { error: srErr } = await supabase
    .from("supply_records")
    .delete()
    .in("id", supplyIds);
  if (srErr) {
    clean = false;
    console.error("[supply] compensate: gagal padam supply_records", srErr);
    // Jangan kembalikan kuantiti jika rekod bekalan masih wujud —
    // itu akan mewujudkan ketidakkonsistenan songsang.
    return false;
  }

  for (const a of applied) {
    const { data: batch, error: readErr } = await supabase
      .from("item_batches")
      .select("kuantiti")
      .eq("id", a.batchId)
      .maybeSingle();
    if (readErr || !batch) {
      clean = false;
      console.error("[supply] compensate: gagal baca kelompok", a.batchId, readErr);
      continue;
    }
    const { error: updErr } = await supabase
      .from("item_batches")
      .update({ kuantiti: batch.kuantiti + a.qty })
      .eq("id", a.batchId);
    if (updErr) {
      clean = false;
      console.error("[supply] compensate: gagal kembalikan stok", a.batchId, updErr);
    }
  }
  return clean;
}

function cleanFailError(err: unknown, cleaned: boolean): Error {
  const base =
    err instanceof Error ? err : new Error((err as { message?: string })?.message || "Gagal membekalkan ubat.");
  if (!cleaned) {
    return new Error(
      `${base.message} (Imbau balik tidak lengkap — sila semak stok secara manual.)`
    );
  }
  return base;
}

/**
 * Proses bekalan pelbagai kelompok:
 *   1. process_supply_multi (atomik) — laluan utama
 *   2. process_supply per kelompok — hanya jika (1) belum deployed
 *   3. tulisan terus + validasi dahulu — hanya jika kedua-dua RPC tiada
 *
 * Melempar ralat jika gagal; pemanggil bertanggungjawab ke atas toast.
 */
export async function runSupplyMulti(
  data: SupplyMultiInput,
  profileId: string | null
): Promise<SupplyMultiResult> {
  // LOW-6: gagalkan dengan jelas tanpa sesi — jika tidak, NULL mengalir ke
  // kakitangan_pembekal NOT NULL dan gagal dengan ralat FK yang samar.
  if (!profileId) {
    throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
  }
  // ── 1. RPC atomik ───────────────────────────────────────────────────────
  // PENTING: hantar array JS mentah (bukan JSON.stringify) — supabase-js
  // mensirikannya sebagai tatasusunan JSONB. Stringifikasi berganda
  // menghasilkan skalar JSON ('"[{...}]"'), dan jsonb_array_elements()
  // di pelayan gagal dengan "cannot extract elements from a scalar".
  // Kekunci juga dipetakan ke snake_case seperti yang dijangka RPC.
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "process_supply_multi",
    {
      p_assignment_id: data.assignmentId,
      p_dos: data.dos,
      p_tempoh_dibekal: data.tempoh,
      p_allocations: data.allocations.map((a) => ({
        batch_id: a.batchId,
        kuantiti: a.kuantiti,
      })),
      p_kakitangan_pembekal: profileId,
      p_catatan_bekalan: data.catatan ?? null,
    }
  );
  if (!rpcError) return { success: true, id: (rpcData as string) ?? null };
  if (!isRpcMissing(rpcError)) throw rpcError;

  // ── 2. Fallback A: process_supply per kelompok (hanya jika RPC1 tiada) ──
  const applied: AppliedWrite[] = [];
  let missingOnFirst = false;
  for (const alloc of data.allocations) {
    const { data: perBatchData, error: perBatchError } = await supabase.rpc(
      "process_supply",
      {
        p_assignment_id: data.assignmentId,
        p_dos: data.dos,
        p_tempoh_dibekal: data.tempoh,
        p_kuantiti: alloc.kuantiti,
        p_batch_id: alloc.batchId,
        p_kakitangan_pembekal: profileId,
        p_catatan_bekalan: data.catatan ?? null,
      }
    );

    if (perBatchError) {
      if (isRpcMissing(perBatchError)) {
        if (applied.length === 0) {
          // process_supply juga tiada → terus ke fallback B (belum tulis apa-apa)
          missingOnFirst = true;
          break;
        }
        // RPC hilang pertengahan-tak masuk akal — imbau dan gagal
        const cleaned = await compensate(applied);
        throw cleanFailError(perBatchError, cleaned);
      }
      // Ralat perniagaan (stok tidak mencukupi, dll.) — imbau yang telah
      // ditulis dahulu supaya tiada bekalan separa, kemudian gagalkan.
      const cleaned = await compensate(applied);
      throw cleanFailError(perBatchError, cleaned);
    }

    if (perBatchData) {
      applied.push({
        supplyId: perBatchData as string,
        batchId: alloc.batchId,
        qty: alloc.kuantiti,
      });
    }
  }

  if (!missingOnFirst) {
    if (applied.length > 0) {
      return { success: true, id: applied[0].supplyId };
    }
    if (data.allocations.length === 0) {
      return { success: true, id: null };
    }
    // process_supply tidak error tetapi tidak pulangkan id — jangan tulis
    // semula secara manual (risiko berganda); gagalkan dengan jelas.
    throw new Error(
      "Proses bekalan tidak mengesahkan rekod — sila semak sejarah bekalan sebelum cuba lagi."
    );
  }

  // ── 3. Fallback B: tulisan terus (kedua-dua RPC tiada) ──────────────────
  return runManualFallback(data, profileId);
}

async function runManualFallback(
  data: SupplyMultiInput,
  profileId: string | null
): Promise<SupplyMultiResult> {
  // Pengawal HIGH-1 (cermin RPC process_supply_multi di pelayan): jangan
  // bekalkan kepada tugasan yang ditamatkan atau pesakit tidak aktif /
  // digabungkan. Laluan ini hanya dicapai jika kedua-dua RPC tiada.
  const { data: assignment, error: assignErr } = await supabase
    .from("patient_item_assignments")
    .select("id, aktif, patient_id")
    .eq("id", data.assignmentId)
    .maybeSingle();
  if (assignErr) throw assignErr;
  if (!assignment) throw new Error("Tugasan tidak dijumpai.");
  if (!assignment.aktif) {
    throw new Error("Tugasan telah ditamatkan — bekalan tidak dibenarkan.");
  }
  const { data: patient, error: patientErr } = await supabase
    .from("patients")
    .select("id, aktif, merged_into")
    .eq("id", assignment.patient_id)
    .maybeSingle();
  if (patientErr) throw patientErr;
  if (!patient || !patient.aktif || patient.merged_into) {
    throw new Error("Pesakit tidak aktif — bekalan tidak dibenarkan.");
  }

  // Validasi DAHULU: baca semua kelompok dalam satu pertanyaan, pastikan
  // tiada kelompok dilupuskan dan stok mencukupi untuk SEMUA alokasi sebelum
  // menulis apa-apa (mengelak keadaan separa akibat alokasi lewat gagal).
  const batchIds = [...new Set(data.allocations.map((a) => a.batchId))];
  const { data: batches, error: readErr } = await supabase
    .from("item_batches")
    .select("id, kuantiti, dilupuskan, tarikh_luput")
    .in("id", batchIds);

  if (readErr) throw readErr;

  const batchMap = new Map<string, { kuantiti: number; dilupuskan: boolean; tarikh_luput: string }>();
  for (const b of batches ?? []) {
    batchMap.set(b.id, { kuantiti: b.kuantiti, dilupuskan: b.dilupuskan, tarikh_luput: b.tarikh_luput });
  }

  // Jejaki baki sepanjang validasi (alokasi mungkin menyentuh kelompok sama)
  const remaining = new Map<string, number>();
  // Tarikh hari ini (KL) — selari dengan penapis UI dan semakan pelayan 063.
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  for (const alloc of data.allocations) {
    const batch = batchMap.get(alloc.batchId);
    if (!batch) throw new Error("Kelompok tidak dijumpai.");
    if (batch.dilupuskan) throw new Error("Kelompok ini telah dilupuskan.");
    if (batch.tarikh_luput && batch.tarikh_luput < todayStr) {
      throw new Error(`Kelompok ${alloc.batchId} telah luput — bekalan dari kelompok luput tidak dibenarkan.`);
    }
    const left = remaining.has(alloc.batchId)
      ? (remaining.get(alloc.batchId) as number)
      : batch.kuantiti;
    if (left < alloc.kuantiti) {
      throw new Error("Stok tidak mencukupi.");
    }
    remaining.set(alloc.batchId, left - alloc.kuantiti);
  }

  // Validasi lulus — tulis. Semak ralat setiap tulisan; imbau pada kegagalan.
  // Setiap transaksi manual berkongsi satu kumpulan_id (migrasi 065) supaya
  // klien mengumpulkan kaki-kakinya secara deterministik.
  const manualGroupId = uuid();
  const applied: AppliedWrite[] = [];
  for (const alloc of data.allocations) {
    const snapshot = batchMap.get(alloc.batchId);
    if (!snapshot) throw new Error("Kelompok tidak dijumpai.");

    // Kemas kini bersyarat: kuantiti semasa mesti sepadan dengan yang
    // disahkan (optimistic concurrency — penulis serentak yang menyelit
    // akan gagal di sini dan bukannya mewujudkan stok negatif senyap).
    const { data: updRows, error: updErr } = await supabase
      .from("item_batches")
      .update({ kuantiti: snapshot.kuantiti - alloc.kuantiti })
      .eq("id", alloc.batchId)
      .eq("kuantiti", snapshot.kuantiti)
      .select("id");
    if (updErr) {
      const cleaned = await compensate(applied);
      throw cleanFailError(updErr, cleaned);
    }
    if (!updRows || updRows.length === 0) {
      const cleaned = await compensate(applied);
      throw cleanFailError(
        new Error("Stok berubah semasa bekalan diproses — sila cuba semula."),
        cleaned
      );
    }
    // Jejak kuantiti semasa untuk imbauan + alokasi seterusnya pada kelompok sama
    batchMap.set(alloc.batchId, {
      ...snapshot,
      kuantiti: snapshot.kuantiti - alloc.kuantiti,
    });

    const { data: supply, error: sErr } = await supabase
      .from("supply_records")
      .insert({
        assignment_id: data.assignmentId,
        dos: data.dos,
        tempoh_dibekal: data.tempoh,
        kuantiti: alloc.kuantiti,
        batch_id: alloc.batchId,
        kakitangan_pembekal: profileId,
        catatan_bekalan: data.catatan || null,
        // Jika lajur belum wujud (migrasi 065 belum dijalankan), PostgREST
        // menolak dengan ralat lajur — cuba semula tanpa lajur supaya
        // bekalan tidak tersekat semasa pelancaran bergilir.
        kumpulan_id: manualGroupId,
      } as Record<string, unknown>)
      .select("id")
      .single();
    if (sErr) {
      const missingGroupCol =
        (sErr as { message?: string }).message?.includes("kumpulan_id") ?? false;
      if (missingGroupCol) {
        const { data: retrySupply, error: retryErr } = await supabase
          .from("supply_records")
          .insert({
            assignment_id: data.assignmentId,
            dos: data.dos,
            tempoh_dibekal: data.tempoh,
            kuantiti: alloc.kuantiti,
            batch_id: alloc.batchId,
            kakitangan_pembekal: profileId,
            catatan_bekalan: data.catatan || null,
          })
          .select("id")
          .single();
        if (retryErr) {
          const cleaned = await compensate(applied);
          throw cleanFailError(retryErr, cleaned);
        }
        // Teruskan aliran biasa dengan rekod gantian.
        const { error: txErr2 } = await supabase.from("inventory_transactions").insert({
          item_id: data.itemId,
          batch_id: alloc.batchId,
          jenis: "keluar",
          kuantiti: alloc.kuantiti,
          rujukan_id: retrySupply.id,
          rujukan_type: "supply",
          catatan: data.catatan || null,
        });
        if (txErr2) {
          const cleaned = await compensate([
            ...applied,
            { supplyId: retrySupply.id, batchId: alloc.batchId, qty: alloc.kuantiti },
          ]);
          throw cleanFailError(txErr2, cleaned);
        }
        applied.push({
          supplyId: retrySupply.id,
          batchId: alloc.batchId,
          qty: alloc.kuantiti,
        });
        continue;
      }
      const cleaned = await compensate(applied);
      throw cleanFailError(sErr, cleaned);
    }

    const { error: txErr } = await supabase.from("inventory_transactions").insert({
      item_id: data.itemId,
      batch_id: alloc.batchId,
      jenis: "keluar",
      kuantiti: alloc.kuantiti,
      rujukan_id: supply.id,
      rujukan_type: "supply",
      catatan: data.catatan || null,
    });
    if (txErr) {
      const cleaned = await compensate([
        ...applied,
        { supplyId: supply.id, batchId: alloc.batchId, qty: alloc.kuantiti },
      ]);
      throw cleanFailError(txErr, cleaned);
    }

    applied.push({
      supplyId: supply.id,
      batchId: alloc.batchId,
      qty: alloc.kuantiti,
    });
  }

  // Pengesahan SELEPAS tulis (MEDIUM-4, TOCTOU): klien tidak boleh memegang
  // kunci baris, jadi nyahaktif/penggabungan yang komit semasa tulisan di atas
  // hanya dapat dikesan sekarang. Jika sasaran sudah tidak sah, imbau balik
  // sepenuhnya (padam jurnal + rekod bekalan + pulangkan stok) — jangan
  // biarkan bekalan hantu.
  const { data: assignmentAfter, error: afterErr } = await supabase
    .from("patient_item_assignments")
    .select("id, aktif, patient_id")
    .eq("id", data.assignmentId)
    .maybeSingle();
  if (afterErr) throw afterErr;
  let targetOk = !!assignmentAfter?.aktif;
  if (targetOk) {
    const { data: patientAfter, error: patientAfterErr } = await supabase
      .from("patients")
      .select("id, aktif, merged_into")
      .eq("id", assignmentAfter!.patient_id)
      .maybeSingle();
    if (patientAfterErr) throw patientAfterErr;
    targetOk =
      !!patientAfter && !!patientAfter.aktif && !patientAfter.merged_into;
  }
  if (!targetOk) {
    const cleaned = await compensate(applied);
    throw cleanFailError(
      new Error(
        "Pesakit/tugasan dinyahaktifkan semasa bekalan diproses — bekalan diimbau balik. Sila semak dan cuba semula jika perlu."
      ),
      cleaned
    );
  }

  return { success: true, id: applied[0]?.supplyId ?? null };
}
