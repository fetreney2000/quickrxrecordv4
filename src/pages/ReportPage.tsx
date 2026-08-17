/**
 * ReportPage — Halaman Laporan dengan 2 tab (Inventori / Transaksi) dan eksport Excel/PDF.
 *
 * Tema: Merah (#f43f5e)
 * Ciri:
 *  - Tab segmented control (Inventori / Transaksi)
 *  - Jadual 6 lajur inventori (Kod, Nama, Kekuatan, Kuota, Jumlah Stok, Status)
 *  - Jadual 7 lajur transaksi (Tarikh, Pesakit, Item, Dos, Kuantiti, Kelompok, Kakitangan)
 *  - Eksport Excel (exceljs) dan PDF (jspdf + jspdf-autotable)
 *  - Fungsi eksport generik (exportToExcel, exportToPDF)
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

async function exportToExcel(
  data: any[],
  filename: string,
  columnLabels?: Record<string, string>
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");

  // Determine columns from first data row
  const keys = data.length > 0 ? Object.keys(data[0]) : [];

  // Auto-generate labels from keys if not provided
  const labels =
    columnLabels ??
    keys.reduce((acc, k) => {
      acc[k] = k
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return acc;
    }, {} as Record<string, string>);

  // Title row
  sheet.mergeCells(1, 1, 1, keys.length);
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Laporan — QuickRxRecord`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1877F2" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  // Date row
  sheet.mergeCells(2, 1, 2, keys.length);
  const dateCell = sheet.getCell("A2");
  dateCell.value = `Dijana pada: ${formatWithLiteralAMPM(new Date(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  dateCell.font = { italic: true, size: 10, color: { argb: "FF65676B" } };
  dateCell.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 20;

  // Header row
  const headerRow = sheet.getRow(3);
  keys.forEach((key, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = labels[key] ?? key;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF374151" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  headerRow.height = 22;

  // Data rows
  data.forEach((row, rowIdx) => {
    const excelRow = sheet.getRow(rowIdx + 4);
    keys.forEach((key, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      cell.value = row[key] ?? "-";
      cell.font = { size: 10 };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFF0F2F5" } },
      };
    });
    // Alternating row color
    if (rowIdx % 2 === 1) {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F9FA" },
        };
      });
    }
  });

  // Footer row
  const footerRowIdx = data.length + 4;
  sheet.mergeCells(footerRowIdx, 1, footerRowIdx, keys.length);
  const footerCell = sheet.getCell(`A${footerRowIdx}`);
  footerCell.value = `Jumlah rekod: ${data.length}`;
  footerCell.font = { bold: true, size: 10, color: { argb: "FF65676B" } };
  footerCell.alignment = { horizontal: "right" };

  // Auto column widths
  keys.forEach((key, idx) => {
    const col = sheet.getColumn(idx + 1);
    const maxLabel = labels[key]?.length ?? key.length;
    const maxData = data.reduce(
      (max, row) => Math.max(max, String(row[key] ?? "-").length),
      0
    );
    col.width = Math.min(40, Math.max(12, Math.max(maxLabel, maxData) + 2));
  });

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
  columnLabels?: Record<string, string>
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const keys = data.length > 0 ? Object.keys(data[0]) : [];
  const labels =
    columnLabels ??
    keys.reduce((acc, k) => {
      acc[k] = k
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return acc;
    }, {} as Record<string, string>);

  // Header bar
  doc.setFillColor(24, 119, 242);
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("QuickRxRecord", 10, 8);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(filename.replace(/_/g, " "), 10, 14);

  // Date + count
  doc.setTextColor(100, 103, 107);
  doc.setFontSize(8);
  const now = formatWithLiteralAMPM(new Date(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Dijana pada: ${now}   |   Jumlah rekod: ${data.length}`, 10, 24);

  // Table
  const head = [keys.map((k) => labels[k] ?? k)];
  const body = data.map((row) => keys.map((k) => String(row[k] ?? "-")));

  autoTable(doc, {
    head,
    body,
    startY: 28,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [28, 30, 33],
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    margin: { top: 28, bottom: 15 },
    // Footer on every page
    didDrawPage: (hookData) => {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      // Footer line
      doc.setDrawColor(221, 223, 226);
      doc.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
      // Footer text
      doc.setFontSize(7);
      doc.setTextColor(150, 153, 155);
      doc.text(
        `QuickRxRecord - ${filename.replace(/_/g, " ")}`,
        10,
        pageHeight - 6
      );
      doc.text(
        `Halaman ${hookData.pageNumber} / ${(doc as any).getNumberOfPages?.() ?? hookData.pageNumber}`,
        pageWidth - 10,
        pageHeight - 6,
        { align: "right" }
      );
    },
  });

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

// ─── Main Component ─────────────────────────────────────────────────────────

type TabKey = "inventory" | "transactions" | "expiry" | "low-stock";

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
      const { data, error } = await supabase
        .from("supply_records")
        .select(
          "*, assignment:patient_item_assignments(patient:patients(nama), item:items(id, nama_item, kekuatan, id_bentuk)), batch:item_batches(nombor_kelompok), staff:profiles!kakitangan_pembekal(nama)"
        )
       .order("created_at", { ascending: false })
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
      await exportToExcel(flat, "Laporan_Inventori", INVENTORY_COLUMN_LABELS);
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
      await exportToPDF(flat, "Laporan_Inventori", INVENTORY_COLUMN_LABELS);
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
      await exportToExcel(mapped, "Laporan_Transaksi", TRANSACTION_COLUMN_LABELS);
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
      await exportToPDF(mapped, "Laporan_Transaksi", TRANSACTION_COLUMN_LABELS);
      toast.success("Fail PDF transaksi berjaya dimuat turun!");
    } catch (err: any) {
      toast.error(`Gagal mengeksport PDF: ${err.message}`);
    }
  };

  // ── Tab config ─────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: typeof Package }[] = [
    { key: "inventory", label: "Inventori", icon: Package },
    { key: "transactions", label: "Transaksi", icon: Activity },
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
          ) : activeTab === "expiry" ? (
            <ExpiryTab data={expiryData} loading={expiryLoading} days={expiryDays} onDaysChange={setExpiryDays} />
          ) : (
            <LowStockTab data={lowStockData} loading={lowStockLoading} />
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
}: {
  data: ExpiringBatchRecord[] | undefined;
  loading: boolean;
  days: number;
  onDaysChange: (days: number) => void;
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
}: {
  data: LowStockRecord[] | undefined;
  loading: boolean;
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
        <div className="p-4 sm:p-5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <AlertTriangle className="w-4 h-4" style={{ color: "#dc2626" }} />
          <div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Stok Rendah</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Item dengan baki semasa kurang daripada keperluan 4 minggu</p>
          </div>
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
