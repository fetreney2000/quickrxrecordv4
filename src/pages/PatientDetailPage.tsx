/**
 * PatientDetailPage — Halaman butiran pesakit.
 */
import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Pill,
  Edit,
  Save,
  Plus,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  User,
  Users,
  Activity,
  Calendar,
  Merge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FoldableCard } from "@/components/ui/foldable-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { useNavStore } from "@/lib/nav-store";
import {
  formatDate,
  formatMyKad,
  formatPhone,
  getInitials,
  toTitleCase,
  myKadToDob,
  formatAge,
  formatItemDisplay,
} from "@/lib/utils";
import {
  usePatient,
  usePatientAssignments,
  useItemForms,
  useUpdatePatient,
  useDeactivatePatient,
  useAddAssignment,
  useStopAssignment,
  useUpdateDose,
  useSupplyMedication,
  useDeleteSupplyRecord,
  useUpdateSupplyRecord,
  useItemsWithStats,
  useLatestSupplyDates,
  useLatestDoseHistoryDos,
  weeksSince,
  type AssignmentWithItem,
} from "@/hooks/use-patient-detail";
import { InfoField, StatCardMini } from "@/components/patient/patient-info-helpers";
import { AssignmentItem } from "@/components/patient/assignment-item";
import {
  DeactivateDialog,
  AddAssignmentDialog,
  SupplyDialog,
  UpdateDoseDialog,
} from "@/components/patient/patient-dialogs";
import {
  StopAssignmentDialog,
  EditSupplyDialog,
  DeleteSupplyDialog,
} from "@/components/patient/patient-dialogs-extra";
import { MergeDialog } from "@/components/patient/merge-dialog";
import type { Patient } from "@/types";

const ASSIGNMENT_PAGE_SIZE = 50;
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" };
const inputBaseStyle: React.CSSProperties = {   background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", height: 40, padding: "0 12px", width: "100%", outline: "none" };

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const setNavSource = useNavStore((s) => s.setNavSource);
  const canEdit = can("manage_patients");
  const [isMobile, setIsMobile] = useState(false);

  // Determine breadcrumb from URL params
  const from = searchParams.get("from");
  const itemName = searchParams.get("item");
  const itemId = searchParams.get("itemId");

  useEffect(() => { setNavSource("list"); }, [setNavSource]);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { data: patient, isLoading } = usePatient(id);
  const { data: assignments = [] } = usePatientAssignments(id);
  const { data: itemsWithStats = [] } = useItemsWithStats();
  const { data: itemForms = [] } = useItemForms();
  const assignmentIds = useMemo(() => assignments.map((a) => a.id), [assignments]);
  const { data: latestSupplyDates } = useLatestSupplyDates(assignmentIds);
  const { data: latestDosMap } = useLatestDoseHistoryDos(assignmentIds);
  const weeksSinceMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const a of assignments) {
      map.set(a.id, weeksSince(latestSupplyDates?.get(a.id)));
    }
    return map;
  }, [assignments, latestSupplyDates]);
  const updatePatient = useUpdatePatient(id);
  const deactivatePatient = useDeactivatePatient(id);
  const addAssignment = useAddAssignment(id);
  const stopAssignment = useStopAssignment(id);
  const updateDoseMut = useUpdateDose(id);
  const supplyMut = useSupplyMedication(id);
  const deleteSupplyMut = useDeleteSupplyRecord(id);
  const updateSupplyMut = useUpdateSupplyRecord(id);

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Patient>>({});
  const [openDeactivate, setOpenDeactivate] = useState(false);
  const [openAddAssignment, setOpenAddAssignment] = useState(false);
  const [openSupply, setOpenSupply] = useState<string | null>(null);
  const [openUpdateDose, setOpenUpdateDose] = useState<string | null>(null);
  const [openStopAssign, setOpenStopAssign] = useState<string | null>(null);
  const [editSupplyRecord, setEditSupplyRecord] = useState<{ id: string; assignment_id: string; dos: string; kuantiti: number; tempoh_dibekal: string | null; catatan_bekalan: string | null; } | null>(null);
  const [deleteSupplyId, setDeleteSupplyId] = useState<{ id: string; assignmentId: string; } | null>(null);
  const [openMerge, setOpenMerge] = useState(false);
  const [assignmentPage, setAssignmentPage] = useState(0);
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);

  const formsMap = useMemo(() => { const map = new Map<string, string>(); itemForms.forEach((f) => map.set(f.id, f.nama)); return map; }, [itemForms]);
  const activeItemIds = useMemo(() => { const set = new Set<string>(); assignments.filter((a) => a.aktif).forEach((a) => set.add(a.item_id)); return set; }, [assignments]);
  const getItemDisplayName = useCallback((item: AssignmentWithItem["item"]) => {
    return formatItemDisplay(item, item?.id_bentuk ? formsMap.get(item.id_bentuk) : null);
  }, [formsMap]);
  const stats = useMemo(() => { const total = assignments.length; const active = assignments.filter((a) => a.aktif).length; return { total, active, inactive: total - active }; }, [assignments]);
  const sortedAssignments = useMemo(() => [...assignments].sort((a, b) => { if (a.aktif !== b.aktif) return a.aktif ? -1 : 1; return new Date(b.tarikh_mula_guna).getTime() - new Date(a.tarikh_mula_guna).getTime(); }), [assignments]);
  const pagedAssignments = useMemo(() => { const from = assignmentPage * ASSIGNMENT_PAGE_SIZE; return sortedAssignments.slice(from, from + ASSIGNMENT_PAGE_SIZE); }, [sortedAssignments, assignmentPage]);
  const assignmentTotalPages = Math.max(1, Math.ceil(sortedAssignments.length / ASSIGNMENT_PAGE_SIZE));
  const supplyAssignment = useMemo(() => {
    const a = assignments.find((x) => x.id === openSupply) ?? null;
    if (!a) return null;
    const effective = latestDosMap?.get(a.id) || a.dos || null;
    return effective !== a.dos ? { ...a, dos: effective } : a;
  }, [assignments, openSupply, latestDosMap]);
  const updateDoseAssignment = useMemo(() => assignments.find((a) => a.id === openUpdateDose) ?? null, [assignments, openUpdateDose]);

  const startEdit = () => { if (!patient) return; setEditData({ nama: patient.nama, nombor_kad_pengenalan: patient.nombor_kad_pengenalan, nombor_pendaftaran_hospital: patient.nombor_pendaftaran_hospital, dokumen_lain: patient.dokumen_lain, nombor_telefon: patient.nombor_telefon, alamat: patient.alamat, catatan: patient.catatan }); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setEditData({}); };
  const saveEdit = () => { if (!editData.nama?.trim()) return; updatePatient.mutate({ ...editData, nama: toTitleCase(editData.nama ?? ""), nombor_kad_pengenalan: formatMyKad(editData.nombor_kad_pengenalan), nombor_telefon: formatPhone(editData.nombor_telefon), nombor_pendaftaran_hospital: editData.nombor_pendaftaran_hospital?.toUpperCase(), alamat: toTitleCase(editData.alamat) } as Partial<Patient>, { onSuccess: () => { setEditMode(false); setEditData({}); } }); };

  // Build breadcrumb items based on navigation source
  const breadcrumbItems = useMemo(() => {
    const items: { label: string; href?: string }[] = [];
    if (from === "item" && itemName && itemId) {
      items.push({ label: "Senarai Inventori", href: "/stok" });
      items.push({ label: itemName, href: `/stok/${itemId}` });
    } else if (from === "search") {
      // From search: just show patient name
    } else {
      // From list: show Senarai Pesakit
      items.push({ label: "Senarai Pesakit", href: "/pesakit" });
    }
    if (patient) items.push({ label: patient.nama });
    return items;
  }, [from, itemName, itemId, patient]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: "var(--card)" }}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--card)" }}>
          <Skeleton className="h-5 w-40 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-[#f0f2f5]">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!patient) {
    return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2" style={{ color: "var(--text-secondary)" }}>
      <User className="w-10 h-10 opacity-40" />
      <p className="text-sm font-medium">Pesakit tidak dijumpai.</p>
      <Button variant="outline" onClick={() => navigate("/pesakit")} className="mt-3" title="Kembali ke senarai pesakit">Kembali ke Senarai Pesakit</Button>
    </div>;
  }

  return (
    <div className="space-y-4" style={{ paddingBottom: isMobile ? 100 : 0 }}>
      <style>{`@media (max-width: 640px) { [role="dialog"] { max-width: calc(100vw - 32px) !important; overflow-y: auto; max-height: 80vh; } }`}</style>
      <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(24,119,242,0.08) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none", zIndex: 0 }} />

      <Breadcrumb items={breadcrumbItems} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)", boxShadow: "0 4px 12px rgba(24,119,242,0.3)" }}>{getInitials(patient.nama)}</div>
          <div className="min-w-0">
            <h1 className="font-bold leading-tight truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em", fontSize: isMobile ? 18 : 22 }}>{patient.nama}</h1>
            <p className="text-[13px] font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>{patient.aktif ? "Aktif" : "Tidak Aktif"} · {patient.nombor_kad_pengenalan ? formatMyKad(patient.nombor_kad_pengenalan) : "Tiada KP"}{patient.nombor_kad_pengenalan && <> · Umur: {formatAge(myKadToDob(patient.nombor_kad_pengenalan))}</>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={() => navigate("/pesakit")} title="Kembali ke senarai"><ArrowLeft className="w-3.5 h-3.5" /> Kembali</Button>
          {canEdit && <Button variant="outline" onClick={() => setOpenMerge(true)} title="Gabung pesakit"><Merge className="w-3.5 h-3.5" /> Gabung</Button>}
          {canEdit && patient.aktif && <Button variant="destructive" onClick={() => setOpenDeactivate(true)} title="Nyahaktifkan pesakit"><ShieldAlert className="w-3.5 h-3.5" /> Nyahaktif</Button>}
        </div>
      </div>

      <div><FoldableCard title={<span className="flex items-center gap-2"><User className="w-4 h-4" style={{ color: "#1877f2" }} /> Maklumat Pesakit</span>}
        headerExtra={canEdit && !editMode && patient.aktif ? <Button size="sm" variant="outline" onClick={startEdit} title="Edit maklumat pesakit"><Edit className="w-3.5 h-3.5" /> Edit</Button> : editMode ? <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={cancelEdit} title="Batal edit">Batal</Button><Button size="sm" onClick={saveEdit} disabled={updatePatient.isPending} title="Simpan perubahan"><Save className="w-3.5 h-3.5" /> Simpan</Button></div> : null}>
        {editMode ? <EditForm editData={editData} setEditData={setEditData} /> : <ViewInfo patient={patient} />}
      </FoldableCard></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardMini icon={Pill} color="#1877f2" label="Jumlah Item" value={stats.total} />
        <StatCardMini icon={Activity} color="#10b981" label="Item Aktif" value={stats.active} />
        <StatCardMini icon={Users} color="#7c3aed" label="Status" value={patient.aktif ? "Aktif" : "Tidak Aktif"} />
        <StatCardMini icon={Calendar} color="#f59e0b" label="Tarikh Daftar" value={patient.tarikh_daftar ?? ""} />
      </div>

      <div><FoldableCard title={<span className="flex items-center gap-2"><Pill className="w-4 h-4" style={{ color: "#1877f2" }} /> Item Didaftarkan<Badge variant="green" className="text-2xs">{stats.active} aktif</Badge>{stats.inactive > 0 && <Badge variant="slate" className="text-2xs">{stats.inactive} tamat</Badge>}</span>}
        headerExtra={canEdit && patient.aktif ? <Button size="sm" onClick={() => setOpenAddAssignment(true)} style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)" }} title="Tambah item baharu untuk pesakit"><Plus className="w-3.5 h-3.5" /> Tambah Item</Button> : null}>
        {assignments.length === 0 ? <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-muted)" }}><Pill className="w-10 h-10 opacity-40" /><p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tiada item didaftarkan</p>{canEdit && patient.aktif && <p className="text-xs">Klik "Tambah Item" untuk mula.</p>}</div> : <>
          <div className="divide-y divide-[#f0f2f5]">{pagedAssignments.map((a) => <AssignmentItem key={a.id} assignment={a} expanded={expandedAssignment === a.id} onToggle={() => setExpandedAssignment(expandedAssignment === a.id ? null : a.id)} onSupply={() => setOpenSupply(a.id)} onUpdateDose={() => setOpenUpdateDose(a.id)} onStop={() => setOpenStopAssign(a.id)} onEditSupply={(s) => setEditSupplyRecord(s)} onDeleteSupply={(id) => setDeleteSupplyId({ id, assignmentId: a.id })} canEdit={canEdit && patient.aktif} formsMap={formsMap} weeksSinceLastSupply={weeksSinceMap.get(a.id) ?? null} />)}</div>
          {assignmentTotalPages > 1 && <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#f0f2f5]"><p className="text-xs" style={{ color: "var(--text-secondary)" }}>Halaman {assignmentPage + 1} daripada {assignmentTotalPages}</p><div className="flex items-center gap-1"><Button variant="outline" size="sm" disabled={assignmentPage === 0} onClick={() => setAssignmentPage((p) => Math.max(0, p - 1))} className="h-7 px-2" style={{ opacity: assignmentPage === 0 ? 0.4 : 1 }} title="Halaman sebelumnya"><ChevronLeft className="w-3.5 h-3.5" /></Button><Button variant="outline" size="sm" disabled={assignmentPage >= assignmentTotalPages - 1} onClick={() => setAssignmentPage((p) => Math.min(assignmentTotalPages - 1, p + 1))} className="h-7 px-2" style={{ opacity: assignmentPage >= assignmentTotalPages - 1 ? 0.4 : 1 }} title="Halaman seterusnya"><ChevronRight className="w-3.5 h-3.5" /></Button></div></div>}
        </>}
      </FoldableCard></div>

      <DeactivateDialog open={openDeactivate} onOpenChange={setOpenDeactivate} onConfirm={() => deactivatePatient.mutate(undefined, { onSuccess: () => setOpenDeactivate(false) })} isPending={deactivatePatient.isPending} patientName={patient.nama} />
      <AddAssignmentDialog open={openAddAssignment} onOpenChange={setOpenAddAssignment} items={itemsWithStats} activeItemIds={activeItemIds} onSubmit={(data) => addAssignment.mutate(data, { onSuccess: () => setOpenAddAssignment(false) })} isPending={addAssignment.isPending} formsMap={formsMap} />
      {supplyAssignment && <SupplyDialog open={!!openSupply} onOpenChange={(o) => !o && setOpenSupply(null)} assignment={supplyAssignment} formsMap={formsMap} onSubmit={(data) => supplyMut.mutate({ ...data, assignmentId: supplyAssignment.id, itemId: supplyAssignment.item_id }, { onSuccess: () => setOpenSupply(null) })} isPending={supplyMut.isPending} />}
      {updateDoseAssignment && <UpdateDoseDialog open={!!openUpdateDose} onOpenChange={(o) => !o && setOpenUpdateDose(null)} currentDose={updateDoseAssignment.dos} onSubmit={(data) => updateDoseMut.mutate({ ...data, assignmentId: updateDoseAssignment.id }, { onSuccess: () => setOpenUpdateDose(null) })} isPending={updateDoseMut.isPending} />}
      <StopAssignmentDialog open={!!openStopAssign} onOpenChange={(o) => !o && setOpenStopAssign(null)} onSubmit={(sebab) => stopAssignment.mutate({ assignmentId: openStopAssign!, sebab }, { onSuccess: () => setOpenStopAssign(null) })} isPending={stopAssignment.isPending} />
      <EditSupplyDialog supply={editSupplyRecord} onClose={() => setEditSupplyRecord(null)} onSubmit={(data) => updateSupplyMut.mutate({ ...data, assignmentId: editSupplyRecord!.assignment_id }, { onSuccess: () => setEditSupplyRecord(null) })} isPending={updateSupplyMut.isPending} />
      <DeleteSupplyDialog target={deleteSupplyId} onClose={() => setDeleteSupplyId(null)} onConfirm={() => deleteSupplyMut.mutate({ supplyId: deleteSupplyId!.id, assignmentId: deleteSupplyId!.assignmentId }, { onSuccess: () => setDeleteSupplyId(null) })} isPending={deleteSupplyMut.isPending} />
      <MergeDialog open={openMerge} onOpenChange={setOpenMerge} primaryPatient={patient} />
    </div>
  );
}

function ViewInfo({ patient }: { patient: Patient }) {
  return <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <InfoField icon={User} label="No. Kad Pengenalan" value={patient.nombor_kad_pengenalan ? formatMyKad(patient.nombor_kad_pengenalan) : null} />
      <InfoField icon={User} label="No. Pendaftaran Hospital" value={patient.nombor_pendaftaran_hospital} />
      <InfoField icon={User} label="Dokumen Lain" value={patient.dokumen_lain} />
      <InfoField icon={User} label="No. Telefon" value={patient.nombor_telefon ? formatPhone(patient.nombor_telefon) : null} />
    </div>
    <InfoField icon={User} label="Tarikh Daftar" value={patient.tarikh_daftar ?? ""} />
    <InfoField icon={User} label="Alamat" value={patient.alamat} block />
    <InfoField icon={User} label="Catatan" value={patient.catatan} block />
  </div>;
}

function EditForm({ editData, setEditData }: { editData: Partial<Patient>; setEditData: (v: Partial<Patient>) => void }) {
  return <div className="space-y-3">
    <div><Label style={labelStyle}>Nama *</Label><Input value={editData.nama ?? ""} onChange={(e) => setEditData({ ...editData, nama: e.target.value })} onBlur={(e) => setEditData({ ...editData, nama: toTitleCase(e.target.value) })} style={inputBaseStyle} /></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div><Label style={labelStyle}>No. Kad Pengenalan</Label><Input value={editData.nombor_kad_pengenalan ?? ""} onChange={(e) => setEditData({ ...editData, nombor_kad_pengenalan: e.target.value })} onBlur={(e) => setEditData({ ...editData, nombor_kad_pengenalan: formatMyKad(e.target.value) })} style={inputBaseStyle} /></div>
      <div><Label style={labelStyle}>No. Pendaftaran Hospital</Label><Input value={editData.nombor_pendaftaran_hospital ?? ""} onChange={(e) => setEditData({ ...editData, nombor_pendaftaran_hospital: e.target.value })} onBlur={(e) => setEditData({ ...editData, nombor_pendaftaran_hospital: e.target.value.toUpperCase() })} style={inputBaseStyle} /></div>
      <div><Label style={labelStyle}>Dokumen Lain</Label><Input value={editData.dokumen_lain ?? ""} onChange={(e) => setEditData({ ...editData, dokumen_lain: e.target.value })} style={inputBaseStyle} /></div>
      <div><Label style={labelStyle}>No. Telefon</Label><Input value={editData.nombor_telefon ?? ""} onChange={(e) => setEditData({ ...editData, nombor_telefon: e.target.value })} onBlur={(e) => setEditData({ ...editData, nombor_telefon: formatPhone(e.target.value) })} style={inputBaseStyle} /></div>
    </div>
    <div><Label style={labelStyle}>Alamat</Label><textarea value={editData.alamat ?? ""} onChange={(e) => setEditData({ ...editData, alamat: e.target.value })} onBlur={(e) => setEditData({ ...editData, alamat: toTitleCase(e.target.value) })} className="w-full text-sm" style={{ ...inputBaseStyle, height: 70, padding: '8px 12px', fontFamily: 'inherit', resize: 'vertical' }} rows={2} /></div>
    <div><Label style={labelStyle}>Catatan</Label><textarea value={editData.catatan ?? ""} onChange={(e) => setEditData({ ...editData, catatan: e.target.value })} className="w-full text-sm" style={{ ...inputBaseStyle, height: 70, padding: '8px 12px', fontFamily: 'inherit', resize: 'vertical' }} rows={2} /></div>
  </div>;
}
