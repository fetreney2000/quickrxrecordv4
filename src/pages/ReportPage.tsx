/**
 * ReportPage — Halaman Laporan dengan 5 tab (Inventori / Transaksi / Penggunaan Tahunan / Akan Luput / Stok Rendah) dan eksport Excel/PDF.
 *
 * Tema: Merah (#f43f5e)
 * Ciri:
 *  - Tab segmented control (5 tab)
 *  - Eksport Excel (exceljs) dan PDF (jspdf + jspdf-autotable) untuk semua tab
 *  - Fungsi eksport generik profesional (exportToExcel, exportToPDF)
 *  - Animasi framer-motion, badge Stok Rendah
 *  - Orb merah, breadcrumb, header dengan ikon BarChart3
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Package,
  Activity,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DateInput } from "@/components/ui/date-input";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { supabase } from "@/lib/supabase";
import { addDaysToDateInput, formatDate, formatItemDisplay, formatTime, formatWithLiteralAMPM, getKLDayEndISO, getKLDayStartISO, getTodayStrKL } from "@/lib/utils";
import { toast } from "sonner";
import type { ItemBatch } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  kod_item: string;
  nama_item: string;
  kekuatan: string | null;
  kuota: number | null;
  item_batches: ItemBatch[];
  bentuk?: string | null;
}

interface TransactionRecord {
  id: string;
  tarikh_dibekal: string;
  dos: string;
  kuantiti: number;
  assignment: {
    patient: { nama: string } | null;
    item: { id?: string; nama_item: string; kekuatan: string | null; id_bentuk?: string | null; bentuk?: string | null } | null;
  } | null;
  batch: { nombor_kelompok: string } | null;
  staff: { nama: string } | null;
}

interface ExpiringBatchRecord extends ItemBatch {
  item: { kod_item: string; nama_item: string; kekuatan: string | null; id_bentuk?: string | null; bentuk?: string | null } | null;
}

interface LowStockRecord {
  id: string;
  kod_item: string;
  nama_item: string;
  kekuatan: string | null;
  bentuk?: string | null;
  requiredFourWeeks: number;
  currentBalance: number;
}

function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
      86400000
  );
}

// ─── Generic Export Helpers ──────────────────────────────────────────────────

function colLetter(idx: number): string {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

async function exportToExcel(
  data: any[],
  filename: string,
  options?: {
    columnLabels?: Record<string, string>;
    subtitle?: string;
    filterInfo?: string;
    numericColumns?: string[];
  }
) {
  if (data.length === 0) return;

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QuickRxRecord";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(filename.replace(/_/g, " "));

  const keys = Object.keys(data[0]);
  const labels =
    options?.columnLabels ??
    keys.reduce((acc, k) => {
      acc[k] = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return acc;
    }, {} as Record<string, string>);

  const now = formatWithLiteralAMPM(new Date(), {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const subtitle = options?.subtitle || "Laporan";
  const metadataParts = [`Dijana pada: ${now} | Jumlah rekod: ${data.length}`];
  if (options?.filterInfo) metadataParts.push(options.filterInfo);
  const metadata = metadataParts.join(" | ");

  // Row 1: Title
  sheet.mergeCells(1, 1, 1, keys.length);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "QuickRxRecord";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B3A5C" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 32;

  // Row 2: Subtitle
  sheet.mergeCells(2, 1, 2, keys.length);
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, size: 11, color: { argb: "FF6B7280" } };
  subtitleCell.alignment = { horizontal: "left" };
  sheet.getRow(2).height = 20;

  // Row 3: Metadata
  sheet.mergeCells(3, 1, 3, keys.length);
  const metaCell = sheet.getCell("A3");
  metaCell.value = metadata;
  metaCell.font = { size: 9, color: { argb: "FF9CA3AF" } };
  metaCell.alignment = { horizontal: "left" };
  sheet.getRow(3).height = 18;

  // Row 4: Blank spacer
  sheet.getRow(4).height = 6;

  // Row 5: Headers
  const headerRow = sheet.getRow(5);
  headerRow.height = 24;
  keys.forEach((key, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = labels[key] ?? key;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B3A5C" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  // Rows 6..N+5: Data
  const numericSet = new Set(options?.numericColumns ?? []);
  data.forEach((row, rowIdx) => {
    const excelRow = sheet.getRow(rowIdx + 6);
    excelRow.height = 18;
    keys.forEach((key, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      const val = row[key];
      cell.value = val ?? "-";
      cell.font = { size: 10, color: { argb: "FF1F2937" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      if (numericSet.has(key)) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      }
      if (rowIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4F8" } };
      }
    });
  });

  // Footer row: record count
  const footerRowIdx = data.length + 6;
  sheet.mergeCells(footerRowIdx, 1, footerRowIdx, keys.length);
  const footerCell = sheet.getCell(`A${footerRowIdx}`);
  footerCell.value = `Jumlah rekod: ${data.length}`;
  footerCell.font = { bold: true, italic: true, size: 10, color: { argb: "FF6B7280" } };
  footerCell.alignment = { horizontal: "right" };
  sheet.getRow(footerRowIdx).height = 20;

  // Column widths
  keys.forEach((key, idx) => {
    const col = sheet.getColumn(idx + 1);
    if (numericSet.has(key)) {
      col.width = 14;
    } else {
      const maxLabel = labels[key]?.length ?? key.length;
      const maxData = data.reduce(
        (max, row) => Math.max(max, String(row[key] ?? "-").length),
        0
      );
      col.width = Math.min(45, Math.max(12, Math.max(maxLabel, maxData) + 2));
    }
  });

  // Workbook config
  sheet.views = [{ state: "frozen", ySplit: 5 }];
  sheet.autoFilter = { from: "A5", to: `${colLetter(keys.length - 1)}5` };
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportToPDF(
  data: any[],
  filename: string,
  options?: {
    columnLabels?: Record<string, string>;
    subtitle?: string;
    filterInfo?: string;
    numericColumns?: string[];
  }
) {
  if (data.length === 0) return;

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const keys = Object.keys(data[0]);
  const labels =
    options?.columnLabels ??
    keys.reduce((acc, k) => {
      acc[k] = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return acc;
    }, {} as Record<string, string>);

  const subtitle = options?.subtitle || "Laporan";
  const numericColIndices = new Set(
    keys.map((k, i) => options?.numericColumns?.includes(k) ? i : -1).filter((i) => i >= 0)
  );

  // 1. Header bar
  doc.setFillColor(27, 58, 92);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("QuickRxRecord", 14, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, 14, 17);

  // 2. Metadata line
  const now = formatWithLiteralAMPM(new Date(), {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const metadataParts = [`Dijana pada: ${now} | Jumlah rekod: ${data.length}`];
  if (options?.filterInfo) metadataParts.push(options.filterInfo);
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(metadataParts.join(" | "), 10, 28);

  // 3. Separator line
  doc.setDrawColor(209, 213, 219);
  doc.line(10, 31, 287, 31);

  // 4. Table
  const head = [keys.map((k) => labels[k] ?? k)];
  const body = data.map((row) => keys.map((k) => String(row[k] ?? "-")));

  autoTable(doc, {
    head,
    body,
    startY: 34,
    headStyles: {
      fillColor: [27, 58, 92],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      lineWidth: 0.1,
      lineColor: [209, 213, 219],
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [31, 41, 55],
      lineWidth: 0.1,
      lineColor: [229, 231, 235],
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [240, 244, 248],
    },
    margin: { top: 34, bottom: 15, left: 10, right: 10 },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && numericColIndices.has(hookData.column.index)) {
        hookData.cell.styles.halign = "right";
      }
    },
    didDrawPage: (hookData) => {
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      doc.setDrawColor(221, 223, 226);
      doc.line(10, ph - 12, pw - 10, ph - 12);
      doc.setFontSize(7);
      doc.setTextColor(150, 153, 155);
      doc.text(`QuickRxRecord — ${subtitle}`, 10, ph - 8);
      doc.text(
        `Halaman ${hookData.pageNumber} / ${(doc as any).getNumberOfPages?.() ?? hookData.pageNumber}`,
        pw - 10, ph - 8, { align: "right" }
      );
    },
  });

  // 5. Post-table summary
  const finalY = (doc as any).lastAutoTable?.finalY ?? 50;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text(`Jumlah rekod: ${data.length}`, 10, finalY + 6);

  doc.save(`${filename}.pdf`);
}

// ─── Helper: Generate column labels for exports ──────────────────────────────

const INVENTORY_COLUMN_LABELS: Record<string, string> = {
  kod_item: "Kod Item",
  nama_item: "Nama Item",
  kekuatan: "Kekuatan",
  kuota: "Kuota",
  nombor_kelompok: "Nombor Kelompok",
  tarikh_luput: "Tarikh Luput",
  kuantiti: "Kuantiti",
};

const TRANSACTION_COLUMN_LABELS: Record<string, string> = {
  tarikh: "Tarikh",
  masa: "Masa",
  pesakit: "Pesakit",
  item: "Item",
  dos: "Dos",
  kuantiti: "Kuantiti",
  kelompok: "Kelompok",
  kakitangan: "Kakitangan",
};

const ANNUAL_USAGE_COLUMN_LABELS: Record<string, string> = {
  bulan: "Bulan",
  jumlah_kuantiti: "Jumlah Kuantiti",
};

const EXPIRY_COLUMN_LABELS: Record<string, string> = {
  kod_item: "Kod Item",
  nama_item: "Nama Item",
  nombor_kelompok: "Nombor Kelompok",
  tarikh_luput: "Tarikh Luput",
  baki_hari: "Baki Hari",
  kuantiti: "Kuantiti",
};

const LOW_STOCK_COLUMN_LABELS: Record<string, string> = {
  kod_item: "Kod Item",
  nama_item: "Nama Item",
  kuantiti_diperlukan: "Kuantiti Diperlukan (4 Minggu)",
  baki_semasa: "Baki Semasa",
};

// ─── Main Component ─────────────────────────────────────────────────────────

type TabKey = "inventory" | "transactions" | "expiry" | "low-stock" | "annual-usage";

const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];

export default function ReportPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("inventory");
  const today = getTodayStrKL();
  const showTodayTransactions = searchParams.get("tab") === "transactions" && searchParams.get("date") === "today";
  const showExpiry = searchParams.get("tab") === "expiry";
  const showLowStock = searchParams.get("tab") === "low-stock";
  const initialExpiryDays = Number(searchParams.get("days")) || 30;
  const [dateFrom, setDateFrom] = useState(showTodayTransactions ? today : "");
  const [dateTo, setDateTo] = useState(showTodayTransactions ? today : "");
  const [expiryDays, setExpiryDays] = useState(initialExpiryDays);
  const currentYear = new Date().getFullYear();
  const [annualUsageId, setAnnualUsageId] = useState<string>("");
  const [annualUsageYear, setAnnualUsageYear] = useState<number>(currentYear);

  useEffect(() => {
    document.title = "Laporan — QuickRxRecord";
    if (showTodayTransactions) {
      setActiveTab("transactions");
      setDateFrom(today);
      setDateTo(today);
    }
    if (showExpiry) {
      setActiveTab("expiry");
      setExpiryDays(initialExpiryDays);
    }
    if (showLowStock) setActiveTab("low-stock");
  }, [showTodayTransactions, showExpiry, showLowStock, today, initialExpiryDays]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ["report-inventory"],
    queryFn: async () => {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_report_inventory");
      if (!rpcErr) {
        return (rpcData ?? []).map((r: any) => ({
          id: r.id,
          kod_item: r.kod_item,
          nama_item: r.nama_item,
          nama_dagangan: r.nama_dagangan,
          kekuatan: r.kekuatan,
          kuota: r.kuota,
          bentuk: r.bentuk,
          item_batches: r.item_batches ?? [],
        })) as InventoryItem[];
      }
      // Prioritize RPC. Only fall back to legacy when the function truly
      // isn't deployed (42883 / does not exist). Genuine RPC errors throw.
      if (rpcErr.code !== "42883" && !rpcErr.message?.includes("does not exist")) {
        throw rpcErr;
      }

      // Fallback: RPC not yet deployed — legacy client-side queries
      const { data, error } = await supabase
        .from("items")
        .select("*, item_batches(*)")
        .eq("aktif", true)
        .order("nama_item");
      if (error) throw error;
      const formIds = [...new Set((data ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
      }
      (data ?? []).forEach((item: any) => { item.bentuk = formMap.get(item.id_bentuk) ?? null; });
      return data as InventoryItem[];
    },
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["report-transactions", dateFrom, dateTo],
    queryFn: async () => {
      const dateFromISO = dateFrom ? getKLDayStartISO(dateFrom) : null;
      const dateToISO = dateTo ? getKLDayEndISO(dateTo) : null;
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_report_transactions",
        { p_date_from: dateFromISO, p_date_to: dateToISO, p_limit: 500 }
      );
      if (!rpcErr) {
        return (rpcData ?? []).map((r: any) => ({
          id: r.id,
          tarikh_dibekal: r.tarikh_dibekal,
          dos: r.dos,
          kuantiti: r.kuantiti,
          assignment: {
            patient: r.patient_nama ? { nama: r.patient_nama } : null,
            item: { nama_item: r.item_nama, kekuatan: r.item_kekuatan, bentuk: r.item_bentuk },
          },
          batch: r.batch_kelompok ? { nombor_kelompok: r.batch_kelompok } : null,
          staff: r.staff_nama ? { nama: r.staff_nama } : null,
        })) as TransactionRecord[];
      }
      // Prioritize RPC. Only fall back to legacy when the function truly
      // isn't deployed (42883 / does not exist). Genuine RPC errors throw.
      if (rpcErr.code !== "42883" && !rpcErr.message?.includes("does not exist")) {
        throw rpcErr;
      }

      // Fallback: RPC not yet deployed — legacy client-side queries
      const { data, error } = await supabase
        .from("supply_records")
        .select(
          "*, assignment:patient_item_assignments(patient:patients(nama), item:items(id, nama_item, kekuatan, id_bentuk)), batch:item_batches(nombor_kelompok), staff:profiles!kakitangan_pembekal(nama)"
        )
       .order("created_at", { ascending: false })
        .is("voided_at", null)
        .gte("tarikh_dibekal", dateFrom ? getKLDayStartISO(dateFrom) : "1900-01-01T00:00:00.000Z")
        .lt("tarikh_dibekal", dateTo ? getKLDayEndISO(dateTo) : "9999-12-31T23:59:59.999Z")
        .limit(500);
      if (error) throw error;
      const formIds = [...new Set((data ?? []).map((record: any) => record.assignment?.item?.id_bentuk).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        (forms ?? []).forEach((form) => formMap.set(form.id, form.nama));
      }
      (data ?? []).forEach((record: any) => {
        const item = record.assignment?.item;
        if (item) item.bentuk = formMap.get(item.id_bentuk) ?? null;
      });
      return data as TransactionRecord[];
    },
  });

  const { data: expiryData, isLoading: expiryLoading } = useQuery({
    queryKey: ["report-expiry", expiryDays],
    queryFn: async () => {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "get_report_expiring_batches",
        { p_days: expiryDays }
      );
      if (!rpcErr) {
        return (rpcData ?? []).map((r: any) => ({
          id: r.id,
          nombor_kelompok: r.nombor_kelompok,
          tarikh_luput: r.tarikh_luput,
          kuantiti: r.kuantiti,
          item_id: "",
          item: {
            kod_item: r.kod_item,
            nama_item: r.nama_item,
            nama_dagangan: r.nama_dagangan,
            kekuatan: r.kekuatan,
            bentuk: r.bentuk,
          },
        })) as ExpiringBatchRecord[];
      }
      // Prioritize RPC. Only fall back to legacy when the function truly
      // isn't deployed (42883 / does not exist). Genuine RPC errors throw.
      if (rpcErr.code !== "42883" && !rpcErr.message?.includes("does not exist")) {
        throw rpcErr;
      }

      // Fallback: RPC not yet deployed — legacy client-side queries
      const expiryStart = getTodayStrKL();
      const expiryEnd = addDaysToDateInput(expiryStart, expiryDays);
      const { data: batches, error: batchError } = await supabase
        .from("item_batches")
        .select("*")
        .eq("dilupuskan", false)
        .gt("kuantiti", 0)
        .gte("tarikh_luput", expiryStart)
        .lte("tarikh_luput", expiryEnd)
        .order("tarikh_luput", { ascending: true });
      if (batchError) throw batchError;

      const itemIds = [...new Set((batches ?? []).map((batch: ItemBatch) => batch.item_id))];
      if (itemIds.length === 0) return [] as ExpiringBatchRecord[];
      const { data: items, error: itemError } = await supabase
        .from("items")
        .select("id, kod_item, nama_item, kekuatan, id_bentuk")
        .in("id", itemIds);
      if (itemError) throw itemError;
      const itemMap = new Map((items ?? []).map((item: any) => [item.id, item]));
      const formIds = [...new Set((items ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        const formMap = new Map((forms ?? []).map((form) => [form.id, form.nama]));
        (items ?? []).forEach((item: any) => { item.bentuk = formMap.get(item.id_bentuk) ?? null; });
      }
      return (batches ?? []).map((batch: ItemBatch) => ({
        ...batch,
        item: itemMap.get(batch.item_id) ?? null,
      })) as ExpiringBatchRecord[];
    },
  });

  const { data: lowStockData, isLoading: lowStockLoading } = useQuery({
    queryKey: ["report-low-stock"],
    queryFn: async () => {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_report_low_stock");
      if (!rpcErr) {
        return (rpcData ?? []).map((r: any) => ({
          id: r.id,
          kod_item: r.kod_item,
          nama_item: r.nama_item,
          nama_dagangan: r.nama_dagangan,
          kekuatan: r.kekuatan,
          bentuk: r.bentuk,
          requiredFourWeeks: Number(r.required_four_weeks),
          currentBalance: Number(r.current_balance),
        })) as LowStockRecord[];
      }
      // Prioritize RPC. Only fall back to legacy when the function truly
      // isn't deployed (42883 / does not exist). Genuine RPC errors throw.
      if (rpcErr.code !== "42883" && !rpcErr.message?.includes("does not exist")) {
        throw rpcErr;
      }

      // Fallback: RPC not yet deployed — legacy client-side queries
      const today = getTodayStrKL();
      const usageStart = addDaysToDateInput(today, -84);
      const usageEnd = addDaysToDateInput(today, 1);
      const [itemsResult, usageResult] = await Promise.all([
        supabase
          .from("items")
          .select("id, kod_item, nama_item, kekuatan, id_bentuk, item_batches(kuantiti, dilupuskan)")
          .eq("aktif", true),
        supabase
          .from("supply_records")
          .select("kuantiti, assignment:patient_item_assignments!inner(item_id)")
          .is("voided_at", null)
          .gte("tarikh_dibekal", getKLDayStartISO(usageStart))
          .lt("tarikh_dibekal", getKLDayStartISO(usageEnd)),
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (usageResult.error) throw usageResult.error;

      const usageByItem = new Map<string, number>();
      (usageResult.data ?? []).forEach((record: any) => {
        const itemId = record.assignment?.item_id;
        if (itemId) usageByItem.set(itemId, (usageByItem.get(itemId) ?? 0) + (record.kuantiti || 0));
      });

      const formIds = [...new Set((itemsResult.data ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
      if (formIds.length > 0) {
        const { data: forms, error: formsError } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        if (formsError) throw formsError;
        const formMap = new Map((forms ?? []).map((form) => [form.id, form.nama]));
        (itemsResult.data ?? []).forEach((item: any) => { item.bentuk = formMap.get(item.id_bentuk) ?? null; });
      }

      return (itemsResult.data ?? [])
        .map((item: any) => {
          const usage12Weeks = usageByItem.get(item.id) ?? 0;
          const requiredFourWeeks = (usage12Weeks / 12) * 4;
          const currentBalance = (item.item_batches ?? []).reduce(
            (sum: number, batch: any) => sum + (batch.dilupuskan ? 0 : batch.kuantiti || 0),
            0
          );
          return { ...item, requiredFourWeeks, currentBalance };
        })
        .filter((item: LowStockRecord) => item.currentBalance < item.requiredFourWeeks)
        .sort((a: LowStockRecord, b: LowStockRecord) => (b.requiredFourWeeks - b.currentBalance) - (a.requiredFourWeeks - a.currentBalance)) as LowStockRecord[];
    },
  });

  // ── Annual usage queries ──────────────────────────────────────────────────

  const { data: allItems = [] } = useQuery({
    queryKey: ["report-all-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, kod_item, nama_item, kekuatan, id_bentuk")
        .eq("aktif", true)
        .order("nama_item");
      if (error) throw error;
      const formIds = [...new Set((data ?? []).map((item: any) => item.id_bentuk).filter(Boolean))];
      const formMap = new Map<string, string>();
      if (formIds.length > 0) {
        const { data: forms } = await supabase.from("item_forms").select("id, nama").in("id", formIds);
        (forms ?? []).forEach((f: any) => formMap.set(f.id, f.nama));
      }
      return (data ?? []).map((item: any) => ({
        ...item,
        bentuk: formMap.get(item.id_bentuk) ?? null,
      })) as { id: string; kod_item: string; nama_item: string; kekuatan: string | null; bentuk: string | null }[];
    },
  });

  interface MonthlyUsage {
    month: number;
    total: number;
  }

  const { data: annualUsageData, isLoading: annualUsageLoading } = useQuery({
    queryKey: ["report-annual-usage", annualUsageId, annualUsageYear],
    enabled: !!annualUsageId,
    queryFn: async () => {
      // Server-side aggregation via RPC — single fast query
      const { data, error } = await supabase.rpc("get_annual_usage", {
        p_item_id: annualUsageId,
        p_year: annualUsageYear,
      });
      if (error) throw error;

      const result: MonthlyUsage[] = MALAY_MONTHS.map((_, i) => ({ month: i + 1, total: 0 }));
      ((data ?? []) as { month: number; total: number }[]).forEach((row) => {
        if (row.month >= 1 && row.month <= 12) {
          result[row.month - 1].total = Number(row.total) || 0;
        }
      });
      return result;
    },
  });

  // ── Export handlers ────────────────────────────────────────────────────────

  const handleExportInventoryExcel = async () => {
    try {
      if (!inventoryData) return;
      // Flatten: each batch becomes a separate row
      const flat = inventoryData.flatMap((item) =>
        item.item_batches.length > 0
          ? item.item_batches.map((b) => ({
              kod_item: item.kod_item,
              nama_item: formatItemDisplay(item),
              kekuatan: item.kekuatan ?? "-",
              kuota: item.kuota ?? "-",
              nombor_kelompok: b.nombor_kelompok,
              tarikh_luput: formatDate(b.tarikh_luput),
              kuantiti: b.kuantiti,
            }))
          : [
              {
                kod_item: item.kod_item,
                nama_item: formatItemDisplay(item),
                kekuatan: item.kekuatan ?? "-",
                kuota: item.kuota ?? "-",
                nombor_kelompok: "-",
                tarikh_luput: "-",
                kuantiti: 0,
              },
            ]
      );
      await exportToExcel(flat, "Laporan_Inventori", {
        columnLabels: INVENTORY_COLUMN_LABELS,
        subtitle: "Paras Stok Inventori",
        numericColumns: ["kuantiti"],
      });
      toast.success("Fail Excel inventori berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport Excel: ${err.message}`);
    }
  };

  const handleExportInventoryPDF = async () => {
    try {
      if (!inventoryData) return;
      const flat = inventoryData.flatMap((item) =>
        item.item_batches.length > 0
          ? item.item_batches.map((b) => ({
              kod_item: item.kod_item,
              nama_item: formatItemDisplay(item),
              kekuatan: item.kekuatan ?? "-",
              kuota: item.kuota ?? "-",
              nombor_kelompok: b.nombor_kelompok,
              tarikh_luput: formatDate(b.tarikh_luput),
              kuantiti: b.kuantiti,
            }))
          : [
              {
                kod_item: item.kod_item,
                nama_item: formatItemDisplay(item),
                kekuatan: item.kekuatan ?? "-",
                kuota: item.kuota ?? "-",
                nombor_kelompok: "-",
                tarikh_luput: "-",
                kuantiti: 0,
              },
            ]
      );
      await exportToPDF(flat, "Laporan_Inventori", {
        columnLabels: INVENTORY_COLUMN_LABELS,
        subtitle: "Paras Stok Inventori",
        numericColumns: ["kuantiti"],
      });
      toast.success("Fail PDF inventori berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport PDF: ${err.message}`);
    }
  };

  const handleExportTransactionExcel = async () => {
    try {
      if (!transactionsData) return;
const mapped = transactionsData.map((t) => ({
        tarikh: formatDate(t.tarikh_dibekal),
        masa: formatTime(t.tarikh_dibekal),
        pesakit: t.assignment?.patient?.nama ?? "-",
        item: formatItemDisplay(t.assignment?.item) || "-",
        dos: t.dos,
        kuantiti: t.kuantiti,
        kelompok: t.batch?.nombor_kelompok ?? "-",
        kakitangan: t.staff?.nama ?? "-",
      }));
      await exportToExcel(mapped, "Laporan_Transaksi", {
        columnLabels: TRANSACTION_COLUMN_LABELS,
        subtitle: "Log Transaksi Bekalan",
        filterInfo: (dateFrom || dateTo)
          ? `Dari: ${dateFrom || "-"} | Hingga: ${dateTo || "-"}`
          : "Semua tarikh",
        numericColumns: ["kuantiti"],
      });
      toast.success("Fail Excel transaksi berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport Excel: ${err.message}`);
    }
  };

  const handleExportTransactionPDF = async () => {
    try {
      if (!transactionsData) return;
const mapped = transactionsData.map((t) => ({
        tarikh: formatDate(t.tarikh_dibekal),
        masa: formatTime(t.tarikh_dibekal),
        pesakit: t.assignment?.patient?.nama ?? "-",
        item: formatItemDisplay(t.assignment?.item) || "-",
        dos: t.dos,
        kuantiti: t.kuantiti,
        kelompok: t.batch?.nombor_kelompok ?? "-",
        kakitangan: t.staff?.nama ?? "-",
      }));
      await exportToPDF(mapped, "Laporan_Transaksi", {
        columnLabels: TRANSACTION_COLUMN_LABELS,
        subtitle: "Log Transaksi Bekalan",
        filterInfo: (dateFrom || dateTo)
          ? `Dari: ${dateFrom || "-"} | Hingga: ${dateTo || "-"}`
          : "Semua tarikh",
        numericColumns: ["kuantiti"],
      });
      toast.success("Fail PDF transaksi berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport PDF: ${err.message}`);
    }
  };

  // ── Annual Usage Export Handlers ──────────────────────────────────────────

  const handleExportAnnualUsageExcel = async () => {
    try {
      if (!annualUsageData || !annualUsageId) return;
      const selectedItem = allItems.find((i) => i.id === annualUsageId);
      const mapped = annualUsageData.map((row) => ({
        bulan: MALAY_MONTHS[row.month - 1],
        jumlah_kuantiti: row.total,
      }));
      const opts = {
        columnLabels: ANNUAL_USAGE_COLUMN_LABELS,
        subtitle: `Penggunaan Tahunan — ${selectedItem ? formatItemDisplay(selectedItem) : ""} (${annualUsageYear})`,
        filterInfo: `Item: ${selectedItem?.kod_item ?? "-"} | Tahun: ${annualUsageYear}`,
        numericColumns: ["jumlah_kuantiti"],
      };
      await exportToExcel(mapped, `Laporan_Penggunaan_Tahunan_${annualUsageYear}`, opts);
      toast.success("Fail Excel penggunaan tahunan berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport Excel: ${err.message}`);
    }
  };

  const handleExportAnnualUsagePDF = async () => {
    try {
      if (!annualUsageData || !annualUsageId) return;
      const selectedItem = allItems.find((i) => i.id === annualUsageId);
      const mapped = annualUsageData.map((row) => ({
        bulan: MALAY_MONTHS[row.month - 1],
        jumlah_kuantiti: row.total,
      }));
      const opts = {
        columnLabels: ANNUAL_USAGE_COLUMN_LABELS,
        subtitle: `Penggunaan Tahunan — ${selectedItem ? formatItemDisplay(selectedItem) : ""} (${annualUsageYear})`,
        filterInfo: `Item: ${selectedItem?.kod_item ?? "-"} | Tahun: ${annualUsageYear}`,
        numericColumns: ["jumlah_kuantiti"],
      };
      await exportToPDF(mapped, `Laporan_Penggunaan_Tahunan_${annualUsageYear}`, opts);
      toast.success("Fail PDF penggunaan tahunan berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport PDF: ${err.message}`);
    }
  };

  // ── Expiry Export Handlers ───────────────────────────────────────────────

  const handleExportExpiryExcel = async () => {
    try {
      if (!expiryData) return;
      const today = getTodayStrKL();
      const mapped = expiryData.map((batch) => ({
        kod_item: batch.item?.kod_item ?? "-",
        nama_item: formatItemDisplay(batch.item) || "-",
        nombor_kelompok: batch.nombor_kelompok,
        tarikh_luput: formatDate(batch.tarikh_luput),
        baki_hari: daysBetween(today, batch.tarikh_luput),
        kuantiti: batch.kuantiti,
      }));
      const opts = {
        columnLabels: EXPIRY_COLUMN_LABELS,
        subtitle: `Kelompok Akan Luput — ${expiryDays} Hari`,
        filterInfo: `Tempoh: ${expiryDays} hari`,
        numericColumns: ["kuantiti", "baki_hari"],
      };
      await exportToExcel(mapped, `Laporan_Akan_Luput_${expiryDays}Hari`, opts);
      toast.success("Fail Excel akan luput berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport Excel: ${err.message}`);
    }
  };

  const handleExportExpiryPDF = async () => {
    try {
      if (!expiryData) return;
      const today = getTodayStrKL();
      const mapped = expiryData.map((batch) => ({
        kod_item: batch.item?.kod_item ?? "-",
        nama_item: formatItemDisplay(batch.item) || "-",
        nombor_kelompok: batch.nombor_kelompok,
        tarikh_luput: formatDate(batch.tarikh_luput),
        baki_hari: daysBetween(today, batch.tarikh_luput),
        kuantiti: batch.kuantiti,
      }));
      const opts = {
        columnLabels: EXPIRY_COLUMN_LABELS,
        subtitle: `Kelompok Akan Luput — ${expiryDays} Hari`,
        filterInfo: `Tempoh: ${expiryDays} hari`,
        numericColumns: ["kuantiti", "baki_hari"],
      };
      await exportToPDF(mapped, `Laporan_Akan_Luput_${expiryDays}Hari`, opts);
      toast.success("Fail PDF akan luput berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport PDF: ${err.message}`);
    }
  };

  // ── Low Stock Export Handlers ────────────────────────────────────────────

  const handleExportLowStockExcel = async () => {
    try {
      if (!lowStockData) return;
      const mapped = lowStockData.map((item) => ({
        kod_item: item.kod_item,
        nama_item: formatItemDisplay(item),
        kuantiti_diperlukan: Math.ceil(item.requiredFourWeeks),
        baki_semasa: item.currentBalance,
      }));
      const opts = {
        columnLabels: LOW_STOCK_COLUMN_LABELS,
        subtitle: "Stok Rendah — Item Di Bawah Paras Minimum",
        numericColumns: ["kuantiti_diperlukan", "baki_semasa"],
      };
      await exportToExcel(mapped, "Laporan_Stok_Rendah", opts);
      toast.success("Fail Excel stok rendah berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport Excel: ${err.message}`);
    }
  };

  const handleExportLowStockPDF = async () => {
    try {
      if (!lowStockData) return;
      const mapped = lowStockData.map((item) => ({
        kod_item: item.kod_item,
        nama_item: formatItemDisplay(item),
        kuantiti_diperlukan: Math.ceil(item.requiredFourWeeks),
        baki_semasa: item.currentBalance,
      }));
      const opts = {
        columnLabels: LOW_STOCK_COLUMN_LABELS,
        subtitle: "Stok Rendah — Item Di Bawah Paras Minimum",
        numericColumns: ["kuantiti_diperlukan", "baki_semasa"],
      };
      await exportToPDF(mapped, "Laporan_Stok_Rendah", opts);
      toast.success("Fail PDF stok rendah berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport PDF: ${err.message}`);
    }
  };

  // ── Tab config ─────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: typeof Package }[] = [
    { key: "inventory", label: "Inventori", icon: Package },
    { key: "transactions", label: "Transaksi", icon: Activity },
    { key: "annual-usage", label: "Penggunaan Tahunan", icon: BarChart3 },
    { key: "expiry", label: "Akan Luput", icon: AlertTriangle },
    { key: "low-stock", label: "Stok Rendah", icon: AlertTriangle },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 relative">
      {/* Background orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "rgba(244, 63, 94, 0.03)",
          filter: "blur(30px)",
          top: -60,
          right: -60,
        }}
      />

      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ label: "Laporan" }]} />
      </div>

      {/* Header */}
      <div
        className="flex items-center gap-3"
      >
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #f43f5e, #e11d48)",
            boxShadow: "0 4px 12px rgba(244,63,94,0.3)",
          }}
        >
          <BarChart3 className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h1
            className="text-2xl font-bold leading-tight truncate"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
          >
            Laporan
          </h1>
          <p
            className="text-sm font-medium mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Laporan inventori dan transaksi bekalan
          </p>
        </div>
      </div>

      {/* Tab Segmented Control */}
      <div>
        <div
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[14px] p-1"
          style={{ background: "var(--bg-secondary)" }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold transition-all duration-200 sm:min-h-0"
                style={{
                  background: isActive ? "var(--card)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  boxShadow: isActive
                    ? "0 1px 4px rgba(0,0,0,0.08)"
                    : "none",
                }}
              >
                <Icon
                  className="w-3.5 h-3.5"
                  style={{
                    color:
                      tab.key === "inventory"
                        ? "#f43f5e"
                        : tab.key === "transactions"
                        ? "#7c3aed"
                        : "#ea580c",
                  }}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
        <div
          key={activeTab}
        >
          {activeTab === "inventory" ? (
            <InventoryTab
              data={inventoryData}
              loading={inventoryLoading}
              onExportExcel={handleExportInventoryExcel}
              onExportPDF={handleExportInventoryPDF}
            />
          ) : activeTab === "transactions" ? (
              <TransactionsTab
                data={transactionsData}
                loading={transactionsLoading}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              onExportExcel={handleExportTransactionExcel}
              onExportPDF={handleExportTransactionPDF}
            />
          ) : activeTab === "annual-usage" ? (
            <AnnualUsageTab
              items={allItems}
              data={annualUsageData}
              loading={annualUsageLoading}
              selectedItemId={annualUsageId}
              selectedYear={annualUsageYear}
              onItemChange={setAnnualUsageId}
              onYearChange={setAnnualUsageYear}
              onExportExcel={handleExportAnnualUsageExcel}
              onExportPDF={handleExportAnnualUsagePDF}
            />
          ) : activeTab === "expiry" ? (
            <ExpiryTab data={expiryData} loading={expiryLoading} days={expiryDays} onDaysChange={setExpiryDays} onExportExcel={handleExportExpiryExcel} onExportPDF={handleExportExpiryPDF} />
          ) : (
            <LowStockTab data={lowStockData} loading={lowStockLoading} onExportExcel={handleExportLowStockExcel} onExportPDF={handleExportLowStockPDF} />
          )}
        </div>
    </div>
  );
}

// ─── Inventory Tab ──────────────────────────────────────────────────────────

function InventoryTab({
  data,
  loading,
  onExportExcel,
  onExportPDF,
}: {
  data: InventoryItem[] | undefined;
  loading: boolean;
  onExportExcel: () => void;
  onExportPDF: () => void;
}) {
  return (
    <Card
      className="relative overflow-hidden"
      style={{
        background: "var(--card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border-medium)",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <CardContent className="p-0 relative">
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" style={{ color: "#f43f5e" }} />
            <h2
              className="text-[15px] font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Paras Stok Inventori
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportExcel}
              disabled={loading || !data}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
              style={{
                background: "rgba(34,197,94,0.08)",
                color: "var(--text-primary)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              onClick={onExportPDF}
              disabled={loading || !data}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
              style={{
                background: "rgba(239,68,68,0.08)",
                color: "var(--text-primary)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>

        {/* Loading / Empty / Table */}
        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-2"
            style={{ color: "var(--text-secondary)" }}
          >
            <Loader2
              className="w-6 h-6 animate-spin"
              style={{ color: "#f43f5e" }}
            />
            <p className="text-sm">Memuatkan laporan...</p>
          </div>
        ) : !data || data.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-2"
            style={{ color: "var(--text-muted)" }}
          >
            <Package className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Tiada data inventori.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Jadual kelompok akan luput" tabIndex={0}>
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  {[
                    "Kod",
                    "Nama Item",
                    "Kekuatan",
                    "Kuota",
                    "Jumlah Stok",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.05em]"
                      style={{
                        color: "var(--text-secondary)",
                        borderBottom: "2px solid var(--border-medium)",
                        background: "var(--bg-secondary)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item) => {
                  const totalStock = item.item_batches.reduce(
                    (s, b) => s + b.kuantiti,
                    0
                  );
                  const isLowStock =
                    item.kuota != null && totalStock < item.kuota;
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors"
                      style={{ background: "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td
                        className="px-3 py-3 text-sm"
                        style={{ borderBottom: "1px solid var(--border-light)" }}
                      >
                        <span style={{ fontFamily: "monospace" }}>
                          {item.kod_item}
                        </span>
                      </td>
                      <td
                        className="px-3 py-3 text-sm"
                        style={{
                          borderBottom: "1px solid var(--border-light)",
                          fontWeight: 500,
                        }}
                      >
                        {formatItemDisplay(item)}
                      </td>
                      <td
                        className="px-3 py-3 text-sm"
                        style={{ borderBottom: "1px solid var(--border-light)" }}
                      >
                        {item.kekuatan ?? "-"}
                      </td>
                      <td
                        className="px-3 py-3 text-sm"
                        style={{ borderBottom: "1px solid var(--border-light)" }}
                      >
                        {item.kuota ?? "-"}
                      </td>
                      <td
                        className="px-3 py-3 text-sm"
                        style={{
                          borderBottom: "1px solid var(--border-light)",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {totalStock.toLocaleString("ms-MY")}
                      </td>
                      <td
                        className="px-3 py-3"
                        style={{ borderBottom: "1px solid var(--border-light)" }}
                      >
                        {isLowStock ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold"
                            style={{
                              background: "rgba(239,68,68,0.1)",
                              color: "#e41e3f",
                            }}
                          >
                            Stok Rendah
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Annual Usage Tab ───────────────────────────────────────────────────────

function AnnualUsageTab({
  items,
  data,
  loading,
  selectedItemId,
  selectedYear,
  onItemChange,
  onYearChange,
  onExportExcel,
  onExportPDF,
}: {
  items: { id: string; kod_item: string; nama_item: string; kekuatan: string | null; bentuk: string | null }[];
  data: { month: number; total: number }[] | undefined;
  loading: boolean;
  selectedItemId: string;
  selectedYear: number;
  onItemChange: (id: string) => void;
  onYearChange: (year: number) => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const totalUsage = data?.reduce((sum, m) => sum + m.total, 0) ?? 0;
  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        background: "var(--card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border-medium)",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <CardContent className="p-0 relative">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: "#f43f5e" }} />
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Jumlah Penggunaan Tahunan</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Jumlah kuantiti dibekal mengikut bulan bagi item yang dipilih</p>
            </div>
          </div>
          {onExportExcel && onExportPDF && (
            <div className="flex items-center gap-2">
              <button
                onClick={onExportExcel}
                disabled={loading || !selectedItemId || !data}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={onExportPDF}
                disabled={loading || !selectedItemId || !data}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <div className="flex-1 min-w-0">
            <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>Item *</label>
            <Combobox
              options={items.map((item) => ({
                value: item.id,
                label: `${formatItemDisplay(item)} (${item.kod_item})`,
              }))}
              value={selectedItemId}
              onValueChange={onItemChange}
              placeholder="Cari item..."
              searchPlaceholder="Cari item..."
              emptyText="Tiada item dijumpai."
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>Tahun</label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="w-full h-10 rounded-xl border px-3 text-sm font-medium"
              style={{ background: "var(--card)", borderColor: "var(--border-medium)", color: "var(--text-primary)", outline: "none" }}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {!selectedItemId ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}>
            <Package className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Pilih item untuk melihat penggunaan tahunan.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#f43f5e" }} />
            <p className="text-sm">Memuatkan data penggunaan...</p>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}>
            <Package className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tiada data penggunaan untuk tahun ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Jadual penggunaan tahunan" tabIndex={0}>
            <table className="w-full min-w-[500px] border-collapse">
              <thead>
                <tr>
                  {["Bulan", "Jumlah Kuantiti"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--text-secondary)", borderBottom: "2px solid var(--border-medium)", background: "var(--bg-secondary)" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.month}>
                    <td className="px-3 py-3 text-sm font-medium" style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)" }}>{MALAY_MONTHS[row.month - 1]}</td>
                    <td className="px-3 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border-light)", color: row.total > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {row.total > 0 ? row.total.toLocaleString("ms-MY") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-3 py-3 text-sm font-bold" style={{ borderTop: "2px solid var(--border-medium)", color: "var(--text-primary)" }}>Jumlah Tahunan</td>
                  <td className="px-3 py-3 text-sm font-bold" style={{ borderTop: "2px solid var(--border-medium)", color: "#f43f5e" }}>
                    {totalUsage.toLocaleString("ms-MY")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Item info */}
        {selectedItem && (
          <div className="px-4 sm:px-5 py-3 text-xs" style={{ borderTop: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{formatItemDisplay(selectedItem)}</span>
            {" "}&middot; {selectedItem.kod_item} &middot; Tahun {selectedYear}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Transactions Tab ───────────────────────────────────────────────────────

function TransactionsTab({
  data,
  loading,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onExportExcel,
  onExportPDF,
}: {
  data: TransactionRecord[] | undefined;
  loading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}) {
  // Only display first 100 records, but all 500 are available for export
  const displayData = data?.slice(0, 100) ?? [];

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        background: "var(--card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border-medium)",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <CardContent className="p-0 relative">
        {/* Header */}
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "#7c3aed" }} />
            <h2
              className="text-[15px] font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Log Transaksi Bekalan
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex items-end gap-2 rounded-xl px-2.5 py-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}>
              <label className="flex flex-col gap-1 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Dari
<DateInput
                value={dateFrom}
                onChange={(v) => onDateFromChange(v)}
                  className="w-full h-11 rounded-lg px-2 text-xs font-medium normal-case tracking-normal sm:h-8"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              </label>
              <span className="pb-2 text-xs" style={{ color: "var(--text-muted)" }}>-</span>
              <label className="flex flex-col gap-1 text-2xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Hingga
<DateInput
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(v) => onDateToChange(v)}
                  className="w-full h-11 rounded-lg px-2 text-xs font-medium normal-case tracking-normal sm:h-8"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
              onClick={onExportExcel}
              disabled={loading || !data}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
              style={{
                background: "rgba(34,197,94,0.08)",
                color: "var(--text-primary)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
              </button>
              <button
              onClick={onExportPDF}
              disabled={loading || !data}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
              style={{
                background: "rgba(239,68,68,0.08)",
                color: "var(--text-primary)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
              </button>
            </div>
          </div>
        </div>

        {/* Loading / Empty / Table */}
        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-2"
            style={{ color: "var(--text-secondary)" }}
          >
            <Loader2
              className="w-6 h-6 animate-spin"
              style={{ color: "#7c3aed" }}
            />
            <p className="text-sm">Memuatkan transaksi...</p>
          </div>
        ) : displayData.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-2"
            style={{ color: "var(--text-muted)" }}
          >
            <Activity className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Tiada data transaksi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Jadual stok rendah" tabIndex={0}>
            <table className="w-full min-w-[620px] border-collapse">
              <thead>
                <tr>
                  {[
                    "Tarikh",
                    "Masa",
                    "Pesakit",
                    "Item",
                    "Dos",
                    "Kuantiti",
                    "Kelompok",
                    "Kakitangan",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.05em]"
                      style={{
                        color: "var(--text-secondary)",
                        borderBottom: "2px solid var(--border-medium)",
                        background: "var(--bg-secondary)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td
                      className="px-3 py-3 text-sm"
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(t.tarikh_dibekal)}
                    </td>
                    <td
                      className="px-3 py-3 text-sm"
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatTime(t.tarikh_dibekal)}
                    </td>
                    <td
                      className="px-3 py-3 text-sm"
                      style={{ borderBottom: "1px solid var(--border-light)" }}
                    >
                      {t.assignment?.patient?.nama ?? "-"}
                    </td>
                    <td
                      className="px-3 py-3 text-sm"
                      style={{ borderBottom: "1px solid var(--border-light)" }}
                    >
                      {formatItemDisplay(t.assignment?.item) || "-"}
                    </td>
                    <td
                      className="px-3 py-3 text-sm"
                      style={{ borderBottom: "1px solid var(--border-light)" }}
                    >
                      {t.dos}
                    </td>
                    <td
                      className="px-3 py-3 text-sm"
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {t.kuantiti}
                    </td>
                    <td
                      className="px-3 py-3 text-sm"
                      style={{ borderBottom: "1px solid var(--border-light)", fontFamily: "monospace" }}
                    >
                      {t.batch?.nombor_kelompok ?? "-"}
                    </td>
                    <td
                      className="px-3 py-3 text-sm"
                      style={{ borderBottom: "1px solid var(--border-light)" }}
                    >
                      {t.staff?.nama ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpiryTab({
  data,
  loading,
  days,
  onDaysChange,
  onExportExcel,
  onExportPDF,
}: {
  data: ExpiringBatchRecord[] | undefined;
  loading: boolean;
  days: number;
  onDaysChange: (days: number) => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
}) {
  const today = getTodayStrKL();
  const displayData = data ?? [];

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        background: "var(--card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border-medium)",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <CardContent className="p-0 relative">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: "#ea580c" }} />
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Kelompok Akan Luput</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Stok yang akan luput dalam tempoh dipilih</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Tempoh
              <select
                value={days}
                onChange={(event) => onDaysChange(Number(event.target.value))}
                className="h-11 rounded-lg px-2 text-xs font-medium sm:h-9"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                {[7, 14, 30, 60, 90, 180].map((duration) => (
                  <option key={duration} value={duration}>{duration} hari</option>
                ))}
              </select>
            </label>
            {onExportExcel && onExportPDF && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onExportExcel}
                  disabled={loading || !data || data.length === 0}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    color: "var(--text-primary)",
                    border: "1px solid rgba(34,197,94,0.2)",
                  }}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  onClick={onExportPDF}
                  disabled={loading || !data || data.length === 0}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    color: "var(--text-primary)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#ea580c" }} />
            <p className="text-sm">Memuatkan kelompok...</p>
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}>
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tiada kelompok akan luput.</p>
            <p className="text-xs">Tiada stok aktif dalam {days} hari akan datang.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Jadual paras stok inventori" tabIndex={0}>
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  {["Kod Item", "Nama Item", "Kelompok", "Tarikh Luput", "Baki Hari", "Kuantiti"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--text-secondary)", borderBottom: "2px solid var(--border-medium)", background: "var(--bg-secondary)" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((batch) => {
                  const remainingDays = daysBetween(today, batch.tarikh_luput);
                  return (
                    <tr key={batch.id} style={{ background: "transparent" }}>
                      <td className="px-3 py-3 text-sm font-mono" style={{ borderBottom: "1px solid var(--border-light)" }}>{batch.item?.kod_item ?? "-"}</td>
                      <td className="px-3 py-3 text-sm" style={{ borderBottom: "1px solid var(--border-light)" }}>{formatItemDisplay(batch.item) || "-"}</td>
                      <td className="px-3 py-3 text-sm font-mono font-semibold" style={{ borderBottom: "1px solid var(--border-light)", color: "#ea580c" }}>{batch.nombor_kelompok}</td>
                      <td className="px-3 py-3 text-sm" style={{ borderBottom: "1px solid var(--border-light)" }}>{formatDate(batch.tarikh_luput)}</td>
                      <td className="px-3 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border-light)", color: remainingDays <= 7 ? "#dc2626" : "#ea580c" }}>{remainingDays} hari</td>
                      <td className="px-3 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border-light)" }}>{batch.kuantiti.toLocaleString("ms-MY")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LowStockTab({
  data,
  loading,
  onExportExcel,
  onExportPDF,
}: {
  data: LowStockRecord[] | undefined;
  loading: boolean;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
}) {
  const displayData = data ?? [];

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        background: "var(--card)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--border-medium)",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <CardContent className="p-0 relative">
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: "#dc2626" }} />
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Stok Rendah</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Item dengan baki semasa kurang daripada keperluan 4 minggu</p>
            </div>
          </div>
          {onExportExcel && onExportPDF && (
            <div className="flex items-center gap-2">
              <button
                onClick={onExportExcel}
                disabled={loading || !data || data.length === 0}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={onExportPDF}
                disabled={loading || !data || data.length === 0}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 sm:min-h-0"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#dc2626" }} />
            <p className="text-sm">Mengira stok rendah...</p>
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}>
            <Package className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tiada item stok rendah.</p>
            <p className="text-xs">Semua baki stok mencukupi untuk keperluan 4 minggu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Jadual transaksi bekalan" tabIndex={0}>
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  {["Kod Item", "Nama Item", "Kuantiti Diperlukan (4 Minggu)", "Baki Semasa"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--text-secondary)", borderBottom: "2px solid var(--border-medium)", background: "var(--bg-secondary)" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 text-sm font-mono" style={{ borderBottom: "1px solid var(--border-light)" }}>{item.kod_item}</td>
                    <td className="px-3 py-3 text-sm" style={{ borderBottom: "1px solid var(--border-light)" }}>{formatItemDisplay(item)}</td>
                    <td className="px-3 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border-light)", color: "#dc2626" }}>{Math.ceil(item.requiredFourWeeks).toLocaleString("ms-MY")}</td>
                    <td className="px-3 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)" }}>{item.currentBalance.toLocaleString("ms-MY")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
