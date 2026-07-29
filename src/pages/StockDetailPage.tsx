/**
 * StockDetailPage — Halaman butiran item inventori.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pill,
  Tag,
  Edit,
  Save,
  Plus,
  History,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Users,
  Package,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  Loader2,
  Inbox,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FoldableCard } from "@/components/ui/foldable-card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { useNavStore } from "@/lib/nav-store";
import {
  formatDate,
  formatNumber,
  fromDateInputValue,
  getKLDate,
  getTodayStrKL,
  KL_LOCALE,
  KL_TIMEZONE,
  toTitleCaseKeepAcronyms,
} from "@/lib/utils";
import {
  useItem,
  useBatches,
  useAddBatch,
  useUpdateBatch,
  useUpdateItem,
  useItemForms,
  useItemCategories,
  useItemPatients,
  useItemTransactionHistory,
  usePatientsList,
  useStaffList,
  type CombinedTransaction,
} from "@/hooks/use-inventory";
import type { ItemBatch } from "@/types";
import { InfoField, StatCardMini } from "@/components/inventory/info-helpers";
import { SortIcon } from "@/components/patient/sort-icon";
import type { SortDir } from "@/hooks/use-patients";
import { AddBatchDialog } from "@/components/inventory/add-batch-dialog";
import { BatchAdjustmentDialog } from "@/components/inventory/batch-adjustment-dialog";
import { BatchRow } from "@/components/inventory/batch-row";
import { PatientUsingRow } from "@/components/inventory/patient-using-row";
import { TransactionRow } from "@/components/inventory/transaction-row";
import { toast } from "sonner";
import type { Item } from "@/types";

const BATCH_PAGE_SIZE = 50;
const PATIENT_PAGE_SIZE = 50;
const TX_PAGE_SIZE = 50;

function getPatientSortVal(p: any, key: string): string | number {
  switch (key) {
    case "nama": return p.patient?.nama?.toLowerCase() || "";
    case "nokp": return p.patient?.nombor_kad_pengenalan || "";
    case "dos": return p.dos || "";
    case "last_supply": return p.last_supply?.tarikh || "";
    case "status": return p.last_supply?.tarikh || "9999-99-99";
    default: return "";
  }
}

function getBatchSortVal(b: any, key: string): string | number {
  switch (key) {
    case "nombor_kelompok": return b.nombor_kelompok || "";
    case "tarikh_luput": return b.tarikh_luput || "";
    case "kuantiti": return b.kuantiti ?? 0;
    case "status": return b.tarikh_luput || "9999-99-99";
    default: return "";
  }
}

function getTxSortVal(tx: any, key: string): string | number {
  switch (key) {
    case "tarikh": return tx.tarikh;
    case "jenis": return tx.jenis_label || "";
    case "kelompok": return tx.kelompok || "";
    case "perubahan": return tx.perubahan;
    case "catatan": return tx.catatan || "";
    case "kakitangan": return tx.kakitangan || "";
    case "pesakit": return tx.pesakit || "";
    default: return "";
  }
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 4,
  display: "block",
};

const inputBaseStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  height: 40,
  padding: "0 12px",
  width: "100%",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputBaseStyle,
  height: "auto",
  minHeight: 70,
  padding: "8px 12px",
  resize: "vertical",
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = {
  ...inputBaseStyle,
  appearance: "auto",
};

export default function StockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const setNavSource = useNavStore((s) => s.setNavSource);
  const canEditItem = can("manage_items");
  const canAddBatch = can("manage_batches");

  const { data: item, isLoading } = useItem(id);

  useEffect(() => {
    document.title = "Butiran Item — QuickRxRecord";
    setNavSource("list");
  }, [setNavSource]);
  const { data: forms = [] } = useItemForms();
  const { data: categories = [] } = useItemCategories();
  const { data: batches = [] } = useBatches(id);
  const { data: patients = [] } = useItemPatients(id);
  const { data: transactions = [] } = useItemTransactionHistory(id);
  const { data: patientsList = [] } = usePatientsList();
  const { data: staffList = [] } = useStaffList();

  const updateItem = useUpdateItem(id);
  const updateBatch = useUpdateBatch(id);

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Item>>({});

  const [openAddBatch, setOpenAddBatch] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<{
    type: "adjust" | "dispose";
    batch: ItemBatch;
    newKuantiti?: number;
  } | null>(null);

  const [batchPage, setBatchPage] = useState(0);
  const [patientPage, setPatientPage] = useState(0);
  const [txPage, setTxPage] = useState(0);

  const [patientSort, setPatientSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [batchSort, setBatchSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [txSort, setTxSort] = useState<{ key: string; dir: SortDir } | null>(null);

  const [patientSearch, setPatientSearch] = useState("");
  const [defaulterFilter, setDefaulterFilter] = useState<string>("all");

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPatient, setFilterPatient] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterTxType, setFilterTxType] = useState<"all" | "bekalan" | "pelarasan">("all");

  const totalStock = useMemo(
    () => batches.reduce((s, b) => s + (b.kuantiti || 0), 0),
    [batches]
  );

  const activePatientCount = useMemo(() => patients.length, [patients]);

  const quotaRemaining = useMemo(() => {
    if (item?.kuota == null) return null;
    return Math.max(0, item.kuota - activePatientCount);
  }, [item?.kuota, activePatientCount]);

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    const now = getKLDate();
    const cutoffMonths = (() => {
      switch (defaulterFilter) {
        case "3m": return 3;
        case "6m": return 6;
        case "9m": return 9;
        case "1y": return 12;
        case "2y": return 24;
        default: return 0;
      }
    })();
    return patients.filter((p) => {
      if (term) {
        const n = p.patient?.nama?.toLowerCase() || "";
        const kp = p.patient?.nombor_kad_pengenalan || "";
        if (!n.includes(term) && !kp.includes(term)) return false;
      }
      if (defaulterFilter !== "all") {
        if (!p.last_supply) return cutoffMonths > 0;
        const lastDate = new Date(p.last_supply.tarikh);
        const monthsAgo =
          (now.getFullYear() - lastDate.getFullYear()) * 12 +
          (now.getMonth() - lastDate.getMonth());
        if (monthsAgo < cutoffMonths) return false;
      }
      return true;
    });
  }, [patients, patientSearch, defaulterFilter]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterDateFrom) {
        const from = new Date(fromDateInputValue(filterDateFrom));
        if (new Date(t.tarikh) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(fromDateInputValue(filterDateTo));
        to.setDate(to.getDate() + 1);
        if (new Date(t.tarikh) >= to) return false;
      }
      if (filterPatient && t.pesakit !== filterPatient) return false;
      if (filterStaff && t.kakitangan !== filterStaff) return false;
      if (filterTxType !== "all" && t.jenis !== filterTxType) return false;
      return true;
    });
  }, [transactions, filterDateFrom, filterDateTo, filterPatient, filterStaff, filterTxType]);

  const txStats = useMemo(() => {
    const total = filteredTransactions.length;
    let inQty = 0;
    let outQty = 0;
    const patientSet = new Set<string>();
    filteredTransactions.forEach((t) => {
      if (t.perubahan > 0) inQty += t.perubahan;
      else outQty += Math.abs(t.perubahan);
      if (t.pesakit) patientSet.add(t.pesakit);
    });
    return { total, inQty, outQty, patientCount: patientSet.size };
  }, [filteredTransactions]);

  const sortedPatients = useMemo(() => {
    if (!patientSort) return filteredPatients;
    return [...filteredPatients].sort((a, b) => {
      const va = getPatientSortVal(a, patientSort.key);
      const vb = getPatientSortVal(b, patientSort.key);
      if (va < vb) return patientSort.dir === "asc" ? -1 : 1;
      if (va > vb) return patientSort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredPatients, patientSort]);

  const sortedBatches = useMemo(() => {
    if (!batchSort) return batches;
    return [...batches].sort((a, b) => {
      const va = getBatchSortVal(a, batchSort.key);
      const vb = getBatchSortVal(b, batchSort.key);
      if (va < vb) return batchSort.dir === "asc" ? -1 : 1;
      if (va > vb) return batchSort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [batches, batchSort]);

  const sortedTransactions = useMemo(() => {
    if (!txSort) return filteredTransactions;
    return [...filteredTransactions].sort((a, b) => {
      const va = getTxSortVal(a, txSort.key);
      const vb = getTxSortVal(b, txSort.key);
      if (va < vb) return txSort.dir === "asc" ? -1 : 1;
      if (va > vb) return txSort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, txSort]);

  const pagedBatches = useMemo(() => {
    const from = batchPage * BATCH_PAGE_SIZE;
    return sortedBatches.slice(from, from + BATCH_PAGE_SIZE);
  }, [sortedBatches, batchPage]);

  const pagedPatients = useMemo(() => {
    const from = patientPage * PATIENT_PAGE_SIZE;
    return sortedPatients.slice(from, from + PATIENT_PAGE_SIZE);
  }, [sortedPatients, patientPage]);

  const pagedTransactions = useMemo(() => {
    const from = txPage * TX_PAGE_SIZE;
    return sortedTransactions.slice(from, from + TX_PAGE_SIZE);
  }, [sortedTransactions, txPage]);

  const batchTotalPages = Math.max(1, Math.ceil(sortedBatches.length / BATCH_PAGE_SIZE));
  const patientTotalPages = Math.max(1, Math.ceil(sortedPatients.length / PATIENT_PAGE_SIZE));
  const txTotalPages = Math.max(1, Math.ceil(sortedTransactions.length / TX_PAGE_SIZE));

  const startEdit = () => {
    if (!item) return;
    setEditData({
      kod_item: item.kod_item,
      nama_item: item.nama_item,
      nama_dagangan: item.nama_dagangan,
      kekuatan: item.kekuatan,
      id_kategori: item.id_kategori,
      id_bentuk: item.id_bentuk,
      kuota: item.kuota,
      catatan: item.catatan,
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditData({});
  };

  const saveEdit = () => {
    if (!editData.nama_item?.trim()) {
      toast.error("Nama item diperlukan.");
      return;
    }
    updateItem.mutate(
      {
        ...editData,
        nama_item: toTitleCaseKeepAcronyms(editData.nama_item ?? ""),
        nama_dagangan: editData.nama_dagangan
          ? toTitleCaseKeepAcronyms(editData.nama_dagangan)
          : null,
        kekuatan: editData.kekuatan
          ? editData.kekuatan.toUpperCase()
          : null,
        kuota: editData.kuota != null ? Number(editData.kuota) : null,
      } as any,
      {
        onSuccess: () => {
          setEditMode(false);
          setEditData({});
        },
      }
    );
  };

  const handleBatchAdjust = (batch: ItemBatch, newKuantiti: number) => {
    if (newKuantiti === batch.kuantiti) {
      toast.info("Tiada perubahan pada kuantiti.");
      return;
    }
    setAdjustDialog({ type: "adjust", batch, newKuantiti });
  };

  const handleBatchDispose = (batch: ItemBatch) => {
    setAdjustDialog({ type: "dispose", batch });
  };

  const handleUpdateBatch = (batchId: string, nombor_kelompok: string, tarikh_luput: string) => {
    updateBatch.mutate({ batchId, nombor_kelompok, tarikh_luput });
  };

  const togglePatientSort = useCallback((key: string) => {
    setPatientSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
    setPatientPage(0);
  }, []);

  const toggleBatchSort = useCallback((key: string) => {
    setBatchSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
    setBatchPage(0);
  }, []);

  const toggleTxSort = useCallback((key: string) => {
    setTxSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "asc" };
    });
    setTxPage(0);
  }, []);

  const handleExportExcel = async () => {
    if (filteredTransactions.length === 0) {
      toast.error("Tiada rekod untuk dieksport.");
      return;
    }
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      wb.creator = "QuickRxRecord";
      wb.created = new Date();
      const ws = wb.addWorksheet("Sejarah Transaksi");
      ws.mergeCells("A1:G1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `Sejarah Transaksi — ${item?.nama_item || ""}`;
      titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1877F2" } };
      ws.getRow(1).height = 28;
      ws.mergeCells("A2:G2");
      const dateCell = ws.getCell("A2");
      dateCell.value = `Dijana pada ${getKLDate().toLocaleString(KL_LOCALE, { timeZone: KL_TIMEZONE })} · ${filteredTransactions.length} rekod`;
      dateCell.font = { size: 10, italic: true, color: { argb: "FF65676B" } };
      dateCell.alignment = { horizontal: "left" };
      ws.getRow(2).height = 18;
      const headers = ["Tarikh", "Jenis", "Kelompok", "Perubahan", "Keterangan", "Kakitangan", "Pesakit"];
      ws.addRow(headers);
      const headerRow = ws.getRow(3);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: { style: "thin", color: { argb: "FFD1D5DB" } }, bottom: { style: "thin", color: { argb: "FFD1D5DB" } }, left: { style: "thin", color: { argb: "FFD1D5DB" } }, right: { style: "thin", color: { argb: "FFD1D5DB" } } };
      });
      headerRow.height = 22;
      filteredTransactions.forEach((tx, i) => {
        const row = ws.addRow([formatDate(tx.tarikh), tx.jenis_label, tx.kelompok, tx.perubahan_label, tx.catatan || "", tx.kakitangan || "", tx.pesakit || ""]);
        if (i % 2 === 0) {
          row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } }; });
        }
        const changeCell = row.getCell(4);
        changeCell.font = { color: tx.perubahan > 0 ? { argb: "FF16A34A" } : tx.perubahan < 0 ? { argb: "FFE41E3F" } : { argb: "FF6B7280" }, bold: true };
        changeCell.alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
      });
      const cols = (ws as any).columns as any[] | undefined;
      cols?.forEach((col) => {
        let maxLength = 12;
        col.eachCell({ includeEmpty: false }, (cell: any) => {
          const v = cell.value ? String(cell.value) : "";
          if (v.length > maxLength) maxLength = Math.min(45, v.length + 2);
        });
        col.width = maxLength;
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sejarah-transaksi-${item?.kod_item || "item"}-${getTodayStrKL()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Fail Excel dimuat turun.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Gagal mengeksport ke Excel.");
    }
  };

  const handleExportPDF = async () => {
    if (filteredTransactions.length === 0) {
      toast.error("Tiada rekod untuk dieksport.");
      return;
    }
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFillColor(24, 119, 242);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Sejarah Transaksi - ${item?.nama_item || ""}`, 14, 15);
      doc.setTextColor(101, 103, 107);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(`Dijana pada ${getKLDate().toLocaleString(KL_LOCALE, { timeZone: KL_TIMEZONE })} · ${filteredTransactions.length} rekod`, 14, 28);
      const tableData = filteredTransactions.map((tx) => [formatDate(tx.tarikh), tx.jenis_label, tx.kelompok, tx.perubahan_label, tx.catatan || "", tx.kakitangan || "", tx.pesakit || ""]);
      autoTable(doc, {
        startY: 33,
        head: [["Tarikh", "Jenis", "Kelompok", "Perubahan", "Keterangan", "Kakitangan", "Pesakit"]],
        body: tableData,
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didParseCell: (data) => {
          if (data.column.index === 3 && data.section === "body") {
            const tx = filteredTransactions[data.row.index];
            if (tx) {
              if (tx.perubahan > 0) { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = "bold"; }
              else if (tx.perubahan < 0) { data.cell.styles.textColor = [228, 30, 63]; data.cell.styles.fontStyle = "bold"; }
            }
            data.cell.styles.halign = "center";
          }
        },
      });
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`QuickRxRecord · Halaman ${i} / ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }
      doc.save(`sejarah-transaksi-${item?.kod_item || "item"}-${getTodayStrKL()}.pdf`);
      toast.success("Fail PDF dimuat turun.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Gagal mengeksport ke PDF.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2" style={{ color: "var(--text-secondary)" }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#7c3aed" }} />
        <p className="text-sm">Memuatkan item...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Senarai Inventori", href: "/stok" }, { label: "Tidak Dijumpai" }]} />
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2" style={{ color: "var(--text-secondary)" }}>
          <Pill className="w-10 h-10 opacity-40" />
          <p className="text-sm font-medium">Item tidak dijumpai.</p>
          <Button variant="outline" onClick={() => navigate("/stok")} className="mt-3">Kembali ke Senarai Inventori</Button>
        </div>
      </div>
    );
  }

  const displayTitle = [item.nama_item, item.kekuatan].filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Senarai Inventori", href: "/stok" }, { label: displayTitle }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
            <Pill className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[20px] font-bold leading-tight truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{displayTitle}</h1>
            <p className="text-[13px] font-medium mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
              <span className="font-mono font-semibold" style={{ color: "#7c3aed" }}>{item.kod_item}</span>
              {item.nama_dagangan && <> · {item.nama_dagangan}</>}
              {item.aktif ? " · Aktif" : " · Tidak Aktif"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={() => navigate("/stok")}><ArrowLeft className="w-3.5 h-3.5" /> Kembali</Button>
        </div>
      </div>

      {/* 1. MAKLUMAT ITEM */}
      <div>
        <FoldableCard title={<span className="flex items-center gap-2"><Pill className="w-4 h-4" style={{ color: "#7c3aed" }} /> Maklumat Item</span>}
          headerExtra={canEditItem && !editMode && item.aktif ? <Button size="sm" variant="outline" onClick={startEdit}><Edit className="w-3.5 h-3.5" /> Edit</Button> : editMode ? <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={cancelEdit}>Batal</Button><Button size="sm" onClick={saveEdit} disabled={updateItem.isPending} style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}>{updateItem.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan</Button></div> : null}
        >
          <div className="pt-3">
            {editMode ? <ItemEditForm editData={editData} setEditData={setEditData} forms={forms} categories={categories} /> : <>
              <ItemView item={item} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <StatCardMini icon={Package} color="#1877f2" label="Jumlah Stok" value={formatNumber(totalStock)} />
                <StatCardMini icon={BarChart3} color="#7c3aed" label="Kuota" value={item.kuota != null ? formatNumber(item.kuota) : "—"} />
                <StatCardMini icon={Users} color="#16a34a" label="Jumlah Pesakit" value={activePatientCount} />
                <StatCardMini icon={Activity} color="#d97706" label="Baki Kuota" value={quotaRemaining != null ? formatNumber(quotaRemaining) : "—"} />
              </div>
            </>}
          </div>
        </FoldableCard>
      </div>

      {/* 2. PESAKIT YANG MENGGUNAKAN */}
      <div>
        <FoldableCard title={<span className="flex items-center gap-2"><Users className="w-4 h-4" style={{ color: "#7c3aed" }} /> Pesakit Yang Menggunakan <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(124,58,237,0.10)", color: "#7c3aed" }}>{filteredPatients.length}</span></span>}>
          <div className="pt-3 pb-2 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <Input value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setPatientPage(0); }} placeholder="Cari nama atau No. KP..." className="h-8 pl-9 text-xs" style={{ background: "rgba(124,58,237,0.04)", border: "1px solid transparent", borderRadius: 10, color: "var(--text-primary)" }} />
            </div>
            <select value={defaulterFilter} onChange={(e) => { setDefaulterFilter(e.target.value); setPatientPage(0); }} className="h-8 text-xs px-2 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-primary)", fontWeight: 500 }}>
              <option value="all">Semua Pesakit</option>
              <option value="3m">Tercicir 3 bulan</option>
              <option value="6m">Tercicir 6 bulan</option>
              <option value="9m">Tercicir 9 bulan</option>
              <option value="1y">Tercicir 1 tahun</option>
              <option value="2y">{"Tercicir > 1 tahun"}</option>
            </select>
          </div>
          {patients.length === 0 ? <EmptyState icon={Users} title="Tiada pesakit berdaftar" hint="Item ini belum didaftarkan kepada mana-mana pesakit." /> : filteredPatients.length === 0 ? <EmptyState icon={Search} title="Tiada pesakit dijumpai" hint="Cuba tukar penapis atau kata kunci carian." /> : <>
            <div className="hidden sm:grid px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "2.5fr 1.8fr 1.2fr 1.5fr 1.2fr", gap: 12, color: "var(--text-secondary)", background: "var(--bg-secondary)", borderBottom: "2px solid var(--border-medium)", borderTop: "1px solid var(--border-light)" }}>
              <button type="button" onClick={() => togglePatientSort("nama")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: patientSort?.key === "nama" ? "#7c3aed" : "var(--text-secondary)" }}>Nama <SortIcon active={patientSort?.key === "nama"} dir={patientSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => togglePatientSort("nokp")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: patientSort?.key === "nokp" ? "#7c3aed" : "var(--text-secondary)" }}>No. KP <SortIcon active={patientSort?.key === "nokp"} dir={patientSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => togglePatientSort("dos")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: patientSort?.key === "dos" ? "#7c3aed" : "var(--text-secondary)" }}>Dos <SortIcon active={patientSort?.key === "dos"} dir={patientSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => togglePatientSort("last_supply")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: patientSort?.key === "last_supply" ? "#7c3aed" : "var(--text-secondary)" }}>Bekalan Terakhir <SortIcon active={patientSort?.key === "last_supply"} dir={patientSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => togglePatientSort("status")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: patientSort?.key === "status" ? "#7c3aed" : "var(--text-secondary)" }}>Status <SortIcon active={patientSort?.key === "status"} dir={patientSort?.dir ?? "asc"} /></button>
            </div>
            {pagedPatients.map((p, idx) => <PatientUsingRow key={p.id} data={p as any} index={idx} itemName={displayTitle} itemId={id} />)}
            {patientTotalPages > 1 && <Pagination page={patientPage} totalPages={patientTotalPages} onChange={setPatientPage} totalCount={filteredPatients.length} itemLabel="pesakit" />}
          </>}
        </FoldableCard>
      </div>

      {/* 3. SENARAI KELOMPOK */}
      <div>
        <FoldableCard title={<span className="flex items-center gap-2"><Package className="w-4 h-4" style={{ color: "#7c3aed" }} /> Senarai Kelompok <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(124,58,237,0.10)", color: "#7c3aed" }}>{batches.length}</span></span>}
          headerExtra={canAddBatch && item.aktif ? <Button size="sm" onClick={() => setOpenAddBatch(true)} style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}><Plus className="w-3.5 h-3.5" /> Tambah Stok</Button> : null}
        >
          {batches.length === 0 ? <EmptyState icon={Package} title="Tiada kelompok" hint={canAddBatch ? "Klik \u201cTambah Stok\u201d untuk mendaftarkan kelompok baharu." : "Item ini belum mempunyai kelompok."} /> : <>
            <div className="hidden sm:grid px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "2fr 1.5fr 1.2fr 1.2fr 1fr", gap: 12, color: "var(--text-secondary)", background: "var(--bg-secondary)", borderBottom: "2px solid var(--border-medium)", borderTop: "1px solid var(--border-light)" }}>
              <button type="button" onClick={() => toggleBatchSort("nombor_kelompok")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: batchSort?.key === "nombor_kelompok" ? "#7c3aed" : "var(--text-secondary)" }}>Nombor Kelompok <SortIcon active={batchSort?.key === "nombor_kelompok"} dir={batchSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleBatchSort("tarikh_luput")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: batchSort?.key === "tarikh_luput" ? "#7c3aed" : "var(--text-secondary)" }}>Tarikh Luput <SortIcon active={batchSort?.key === "tarikh_luput"} dir={batchSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleBatchSort("kuantiti")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: batchSort?.key === "kuantiti" ? "#7c3aed" : "var(--text-secondary)" }}>Kuantiti <SortIcon active={batchSort?.key === "kuantiti"} dir={batchSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleBatchSort("status")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: batchSort?.key === "status" ? "#7c3aed" : "var(--text-secondary)" }}>Status <SortIcon active={batchSort?.key === "status"} dir={batchSort?.dir ?? "asc"} /></button>
              <span className="text-right">Tindakan</span>
            </div>
            {pagedBatches.map((b, idx) => <BatchRow key={b.id} batch={b} index={idx} canEdit={canAddBatch && item.aktif} onConfirmAdjust={handleBatchAdjust} onDispose={handleBatchDispose} onUpdateBatch={handleUpdateBatch} />)}
            {batchTotalPages > 1 && <Pagination page={batchPage} totalPages={batchTotalPages} onChange={setBatchPage} totalCount={batches.length} itemLabel="kelompok" />}
          </>}
        </FoldableCard>
      </div>

      {/* 4. SEJARAH TRANSAKSI */}
      <div>
        <FoldableCard title={<span className="flex items-center gap-2"><History className="w-4 h-4" style={{ color: "#7c3aed" }} /> Sejarah Transaksi Item <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(124,58,237,0.10)", color: "#7c3aed" }}>{filteredTransactions.length}</span></span>}
          headerExtra={<div className="flex items-center gap-1.5"><Button size="sm" variant="outline" onClick={handleExportExcel} disabled={filteredTransactions.length === 0} title="Eksport ke Excel"><FileSpreadsheet className="w-3.5 h-3.5" style={{ color: "#16a34a" }} /><span className="hidden sm:inline">Excel</span></Button><Button size="sm" variant="outline" onClick={handleExportPDF} disabled={filteredTransactions.length === 0} title="Eksport ke PDF"><FileText className="w-3.5 h-3.5" style={{ color: "#dc2626" }} /><span className="hidden sm:inline">PDF</span></Button></div>}
        >
          <div className="pt-3 pb-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div><Label style={labelStyle}>Dari</Label><Input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setTxPage(0); }} className="h-8 text-xs" style={inputBaseStyle} /></div>
            <div><Label style={labelStyle}>Hingga</Label><Input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setTxPage(0); }} className="h-8 text-xs" style={inputBaseStyle} /></div>
            <div><Label style={labelStyle}>Pesakit</Label><select value={filterPatient} onChange={(e) => { setFilterPatient(e.target.value); setTxPage(0); }} className="h-8 text-xs w-full px-2" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontWeight: 500 }}><option value="">Semua</option>{patientsList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}</select></div>
            <div><Label style={labelStyle}>Kakitangan</Label><select value={filterStaff} onChange={(e) => { setFilterStaff(e.target.value); setTxPage(0); }} className="h-8 text-xs w-full px-2" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontWeight: 500 }}><option value="">Semua</option>{staffList.map((s) => <option key={s.id} value={s.nama}>{s.nama}</option>)}</select></div>
            <div><Label style={labelStyle}>Jenis</Label><select value={filterTxType} onChange={(e) => { setFilterTxType(e.target.value as any); setTxPage(0); }} className="h-8 text-xs w-full px-2" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontWeight: 500 }}><option value="all">Semua</option><option value="bekalan">Bekalan</option><option value="pelarasan">Pelarasan</option></select></div>
          </div>
          <div className="flex items-center justify-end pb-2">
            <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterPatient(""); setFilterStaff(""); setFilterTxType("all"); setTxPage(0); }} className="text-2xs font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: "#7c3aed" }}><RotateCcw className="w-3 h-3" /> Reset Penapis</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <TxStatBadge icon={BarChart3} color="#65676b" label="Jumlah Transaksi" value={txStats.total.toString()} />
            <TxStatBadge icon={TrendingUp} color="#16a34a" label="Item Masuk" value={`+${formatNumber(txStats.inQty)}`} />
            <TxStatBadge icon={TrendingDown} color="#e41e3f" label="Item Keluar" value={`-${formatNumber(txStats.outQty)}`} />
            <TxStatBadge icon={Users} color="#1877f2" label="Pesakit Menerima" value={txStats.patientCount.toString()} />
          </div>
          {filteredTransactions.length === 0 ? <EmptyState icon={History} title="Tiada sejarah transaksi" hint={transactions.length === 0 ? "Belum ada transaksi untuk item ini." : "Tiada rekod menepati penapis semasa."} /> : <>
            <div className="hidden lg:grid px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "1.5fr 1.3fr 1.3fr 1fr 1.8fr 1.3fr 1.3fr", gap: 12, color: "var(--text-secondary)", background: "var(--bg-secondary)", borderBottom: "2px solid var(--border-medium)", borderTop: "1px solid var(--border-light)" }}>
              <button type="button" onClick={() => toggleTxSort("tarikh")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: txSort?.key === "tarikh" ? "#7c3aed" : "var(--text-secondary)" }}>Tarikh <SortIcon active={txSort?.key === "tarikh"} dir={txSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleTxSort("jenis")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: txSort?.key === "jenis" ? "#7c3aed" : "var(--text-secondary)" }}>Jenis <SortIcon active={txSort?.key === "jenis"} dir={txSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleTxSort("kelompok")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: txSort?.key === "kelompok" ? "#7c3aed" : "var(--text-secondary)" }}>Kelompok <SortIcon active={txSort?.key === "kelompok"} dir={txSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleTxSort("perubahan")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: txSort?.key === "perubahan" ? "#7c3aed" : "var(--text-secondary)" }}>Perubahan <SortIcon active={txSort?.key === "perubahan"} dir={txSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleTxSort("catatan")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: txSort?.key === "catatan" ? "#7c3aed" : "var(--text-secondary)" }}>Keterangan <SortIcon active={txSort?.key === "catatan"} dir={txSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleTxSort("kakitangan")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: txSort?.key === "kakitangan" ? "#7c3aed" : "var(--text-secondary)" }}>Kakitangan <SortIcon active={txSort?.key === "kakitangan"} dir={txSort?.dir ?? "asc"} /></button>
              <button type="button" onClick={() => toggleTxSort("pesakit")} className="flex items-center gap-1 text-left hover:text-foreground transition-colors" style={{ color: txSort?.key === "pesakit" ? "#7c3aed" : "var(--text-secondary)" }}>Pesakit <SortIcon active={txSort?.key === "pesakit"} dir={txSort?.dir ?? "asc"} /></button>
            </div>
            {pagedTransactions.map((tx, idx) => <TransactionRow key={tx.id} tx={tx} index={idx} />)}
            {txTotalPages > 1 && <Pagination page={txPage} totalPages={txTotalPages} onChange={setTxPage} totalCount={filteredTransactions.length} itemLabel="transaksi" />}
          </>}
        </FoldableCard>
      </div>

      {id && <>
        <AddBatchDialog open={openAddBatch} onOpenChange={setOpenAddBatch} itemId={id} />
        <BatchAdjustmentDialog open={!!adjustDialog} onOpenChange={(o) => !o && setAdjustDialog(null)} actionType={adjustDialog?.type ?? "adjust"} batch={adjustDialog?.batch ?? null} newKuantiti={adjustDialog?.newKuantiti} itemId={id} />
      </>}
    </div>
  );
}

function ItemView({ item }: { item: Item }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoField icon={Tag} label="Kod Item" value={item.kod_item} mono />
        <InfoField icon={Tag} label="Nama Dagangan" value={item.nama_dagangan} />
        <InfoField icon={Activity} label="Kekuatan" value={item.kekuatan} mono />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoField icon={BarChart3} label="Kategori" value={(item as any).item_categories?.nama ?? null} />
        <InfoField icon={Package} label="Bentuk Dos" value={(item as any).item_forms?.nama ?? null} />
        <InfoField icon={BarChart3} label="Jumlah Kuota" value={item.kuota != null ? formatNumber(item.kuota) : null} />
      </div>
      {item.catatan && <InfoField icon={Edit} label="Catatan" value={item.catatan} block />}
    </div>
  );
}

function ItemEditForm({ editData, setEditData, forms, categories }: { editData: Partial<Item>; setEditData: (v: Partial<Item>) => void; forms: { id: string; nama: string }[]; categories: { id: string; nama: string }[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label style={labelStyle}>Kod Item</Label><Input value={editData.kod_item ?? ""} readOnly className="bg-muted/30" style={{ ...inputBaseStyle, fontFamily: "ui-monospace, SFMono-Regular, monospace" }} /></div>
        <div><Label style={labelStyle}>Kekuatan</Label><Input value={editData.kekuatan ?? ""} onChange={(e) => setEditData({ ...editData, kekuatan: e.target.value })} onBlur={(e) => setEditData({ ...editData, kekuatan: e.target.value.toUpperCase() })} style={{ ...inputBaseStyle, textTransform: "uppercase" }} /></div>
      </div>
      <div><Label style={labelStyle}>Nama Item <span style={{ color: "#dc2626" }}>*</span></Label><Input value={editData.nama_item ?? ""} onChange={(e) => setEditData({ ...editData, nama_item: e.target.value })} onBlur={(e) => setEditData({ ...editData, nama_item: toTitleCaseKeepAcronyms(e.target.value) })} style={inputBaseStyle} /></div>
      <div><Label style={labelStyle}>Nama Dagangan</Label><Input value={editData.nama_dagangan ?? ""} onChange={(e) => setEditData({ ...editData, nama_dagangan: e.target.value })} onBlur={(e) => setEditData({ ...editData, nama_dagangan: toTitleCaseKeepAcronyms(e.target.value) })} style={inputBaseStyle} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label style={labelStyle}>Kategori</Label><select value={editData.id_kategori ?? ""} onChange={(e) => setEditData({ ...editData, id_kategori: e.target.value })} style={selectStyle}><option value="">- Pilih -</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></div>
        <div><Label style={labelStyle}>Bentuk Dos</Label><select value={editData.id_bentuk ?? ""} onChange={(e) => setEditData({ ...editData, id_bentuk: e.target.value })} style={selectStyle}><option value="">- Pilih -</option>{forms.map((f) => <option key={f.id} value={f.id}>{f.nama}</option>)}</select></div>
      </div>
      <div><Label style={labelStyle}>Jumlah Kuota</Label><Input type="number" min={0} value={editData.kuota ?? ""} onChange={(e) => setEditData({ ...editData, kuota: e.target.value ? parseInt(e.target.value, 10) : (null as any) })} style={inputBaseStyle} /></div>
      <div><Label style={labelStyle}>Catatan</Label><textarea value={editData.catatan ?? ""} onChange={(e) => setEditData({ ...editData, catatan: e.target.value })} style={textareaStyle} rows={2} /></div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: "var(--text-muted)" }}>
      <Icon className="w-10 h-10 opacity-40" />
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{title}</p>
      <p className="text-xs">{hint}</p>
    </div>
  );
}

function Pagination({ page, totalPages, onChange, totalCount, itemLabel }: { page: number; totalPages: number; onChange: (p: number) => void; totalCount: number; itemLabel: string }) {
  const buttons: (number | string)[] = [];
  const maxVisible = 5;
  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) buttons.push(i);
  } else {
    buttons.push(1);
    if (page > 2) buttons.push("...");
    const start = Math.max(2, page);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) buttons.push(i);
    if (page < totalPages - 3) buttons.push("...");
    buttons.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-[#f0f2f5]">
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {totalCount} {itemLabel} · Halaman {page + 1}/{totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onChange(Math.max(0, page - 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
          style={{
            background: page === 0 ? "transparent" : "rgba(0,0,0,0.04)",
            color: "var(--text-secondary)",
            border: "1px solid",
            borderColor: page === 0 ? "transparent" : "var(--border-medium)",
            cursor: page === 0 ? "default" : "pointer",
          }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {buttons.map((b, i) =>
          b === "..." ? (
            <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>…</span>
          ) : (
            <button
              key={b}
              type="button"
              onClick={() => onChange((b as number) - 1)}
              className="w-7 h-7 rounded-lg text-xs font-semibold transition-colors"
              style={
                (b as number) === page + 1
                  ? { background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", cursor: "pointer" }
                  : { background: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border-medium)", cursor: "pointer" }
              }
            >
              {b}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
          style={{
            background: page >= totalPages - 1 ? "transparent" : "rgba(0,0,0,0.04)",
            color: "var(--text-secondary)",
            border: "1px solid",
            borderColor: page >= totalPages - 1 ? "transparent" : "var(--border-medium)",
            cursor: page >= totalPages - 1 ? "default" : "pointer",
          }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function TxStatBadge({ icon: Icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: string }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: "var(--card)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, color }}><Icon className="w-3.5 h-3.5" strokeWidth={2.2} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-secondary)" }}>{label}</p>
          <p className="text-sm font-extrabold truncate" style={{ color: "var(--text-primary)" }}>{value}</p>
        </div>
      </div>
    </div>
  );
}