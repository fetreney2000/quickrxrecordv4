/**
 * PatientDetailPage — Halaman butiran pesakit.
 */
import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FoldableCard } from "@/components/ui/foldable-card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useAuth } from "@/hooks/use-auth";
import { useNavStore } from "@/lib/nav-store";
import {
  formatDate,
  formatMyKad,
  formatPhone,
  getInitials,
  toTitleCase,
} from "@/lib/utils";
import {
  usePatient,
  usePatientAssignments,
  useUpdatePatient,
  useDeactivatePatient,
  useAddAssignment,
  useStopAssignment,
  useUpdateDose,
  useSupplyMedication,
  useDeleteSupplyRecord,
  useUpdateSupplyRecord,
  useItemsWithStats,
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
import type { Patient } from "@/types";

const ASSIGNMENT_PAGE_SIZE = 50;
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#65676b",
  marginBottom: 4,
  display: "block",
};
const inputBaseStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #dddfe2",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  color: "#1c1e21",
  height: 40,
  padding: "0 12px",
  width: "100%",
  outline: "none",
};

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const setNavSource = useNavStore((s) => s.setNavSource);
  const canEdit = can("manage_patients");

  useEffect(() => {
    setNavSource("list");
  }, [setNavSource]);

  const { data: patient, isLoading } = usePatient(id);
  const { data: assignments = [] } = usePatientAssignments(id);
  const { data: itemsWithStats = [] } = useItemsWithStats();

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
  const [editSupplyRecord, setEditSupplyRecord] = useState<{
    id: string;
    assignment_id: string;
    dos: string;
    kuantiti: number;
    tempoh_dibekal: string | null;
    catatan_bekalan: string | null;
  } | null>(null);
  const [deleteSupplyId, setDeleteSupplyId] = useState<{
    id: string;
    assignmentId: string;
  } | null>(null);

  const [assignmentPage, setAssignmentPage] = useState(0);
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(
    null
  );

  const stats = useMemo(() => {
    const total = assignments.length;
    const active = assignments.filter((a) => a.aktif).length;
    return { total, active };
  }, [assignments]);

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
      const ad = new Date(a.tarikh_mula_guna).getTime();
      const bd = new Date(b.tarikh_mula_guna).getTime();
      return bd - ad;
    });
  }, [assignments]);

  const pagedAssignments = useMemo(() => {
    const from = assignmentPage * ASSIGNMENT_PAGE_SIZE;
    return sortedAssignments.slice(from, from + ASSIGNMENT_PAGE_SIZE);
  }, [sortedAssignments, assignmentPage]);

  const assignmentTotalPages = Math.max(
    1,
    Math.ceil(sortedAssignments.length / ASSIGNMENT_PAGE_SIZE)
  );

  const activeAssignmentItems = useMemo(() => {
    const set = new Set<string>();
    assignments
      .filter((a) => a.aktif)
      .forEach((a) => set.add(a.item_id));
    return set;
  }, [assignments]);

  const supplyAssignment = useMemo(
    () => assignments.find((a) => a.id === openSupply) ?? null,
    [assignments, openSupply]
  );
  const updateDoseAssignment = useMemo(
    () => assignments.find((a) => a.id === openUpdateDose) ?? null,
    [assignments, openUpdateDose]
  );

  const startEdit = () => {
    if (!patient) return;
    setEditData({
      nama: patient.nama,
      nombor_kad_pengenalan: patient.nombor_kad_pengenalan,
      nombor_pendaftaran_hospital: patient.nombor_pendaftaran_hospital,
      nombor_telefon: patient.nombor_telefon,
      alamat: patient.alamat,
      catatan: patient.catatan,
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditData({});
  };

  const saveEdit = () => {
    if (!editData.nama?.trim()) return;
    updatePatient.mutate(
      {
        ...editData,
        nama: toTitleCase(editData.nama ?? ""),
        nombor_kad_pengenalan: formatMyKad(editData.nombor_kad_pengenalan),
        nombor_telefon: formatPhone(editData.nombor_telefon),
        nombor_pendaftaran_hospital:
          editData.nombor_pendaftaran_hospital?.toUpperCase(),
        alamat: toTitleCase(editData.alamat),
      } as Partial<Patient>,
      {
        onSuccess: () => {
          setEditMode(false);
          setEditData({});
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] gap-2"
        style={{ color: "#65676b" }}
      >
        <div
          className="w-8 h-8 rounded-full border-[3px] animate-spin"
          style={{
            borderColor: "rgba(24,119,242,0.2)",
            borderTopColor: "#1877f2",
          }}
        />
        <p className="text-sm">Memuatkan...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] gap-2"
        style={{ color: "#65676b" }}
      >
        <User className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Pesakit tidak dijumpai.</p>
        <Button
          variant="outline"
          onClick={() => navigate("/pesakit")}
          className="mt-3"
        >
          Kembali ke Senarai Pesakit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Senarai Pesakit", href: "/pesakit" },
          { label: patient.nama },
        ]}
        icon={Stethoscope}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
              boxShadow: "0 4px 12px rgba(24,119,242,0.3)",
            }}
          >
            {getInitials(patient.nama)}
          </div>
          <div className="min-w-0">
            <h1
              className="text-[22px] sm:text-[20px] font-bold leading-tight truncate"
              style={{ color: "#1c1e21", letterSpacing: "-0.01em" }}
            >
              {patient.nama}
            </h1>
            <p
              className="text-[13px] font-medium mt-0.5"
              style={{ color: "#65676b" }}
            >
              {patient.aktif ? "Aktif" : "Tidak Aktif"} ·{" "}
              {patient.nombor_kad_pengenalan
                ? formatMyKad(patient.nombor_kad_pengenalan)
                : "Tiada KP"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={() => navigate("/pesakit")}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali
          </Button>
          {canEdit && patient.aktif && (
            <Button
              variant="destructive"
              onClick={() => setOpenDeactivate(true)}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Nyahaktif
            </Button>
          )}
        </div>
      </motion.div>

      {/* Patient Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.15 }}
      >
        <Card>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#f0f2f5]">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" style={{ color: "#1877f2" }} />
              <h2 className="text-base font-bold" style={{ color: "#1c1e21" }}>
                Maklumat Pesakit
              </h2>
            </div>
            {canEdit && !editMode && patient.aktif && (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Edit className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}
            {editMode && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={updatePatient.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan
                </Button>
              </div>
            )}
          </div>
          <CardContent className="pt-5">
            {editMode ? (
              <EditForm editData={editData} setEditData={setEditData} />
            ) : (
              <ViewInfo patient={patient} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.15 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <StatCardMini
          icon={Pill}
          color="#1877f2"
          label="Jumlah Item"
          value={stats.total}
        />
        <StatCardMini
          icon={User}
          color="#10b981"
          label="Item Aktif"
          value={stats.active}
        />
        <StatCardMini
          icon={User}
          color="#7c3aed"
          label="Status"
          value={patient.aktif ? "Aktif" : "Tidak Aktif"}
        />
        <StatCardMini
          icon={User}
          color="#f59e0b"
          label="Tarikh Daftar"
          value={patient.tarikh_daftar ?? ""}
        />
      </motion.div>

      {/* Items List */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.15 }}
      >
        <FoldableCard
          title={
            <span className="flex items-center gap-2">
              <Pill className="w-4 h-4" style={{ color: "#1877f2" }} />
              Item Didaftarkan
            </span>
          }
          headerExtra={
            canEdit && patient.aktif ? (
              <Button
                size="sm"
                onClick={() => setOpenAddAssignment(true)}
                style={{
                  background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Item
              </Button>
            ) : null
          }
        >
          {assignments.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 gap-2"
              style={{ color: "#9ca3af" }}
            >
              <Pill className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium" style={{ color: "#65676b" }}>
                Tiada item didaftarkan
              </p>
              {canEdit && patient.aktif && (
                <p className="text-xs">Klik "Tambah Item" untuk mula.</p>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#f0f2f5]">
                {pagedAssignments.map((a) => (
                  <AssignmentItem
                    key={a.id}
                    assignment={a}
                    expanded={expandedAssignment === a.id}
                    onToggle={() =>
                      setExpandedAssignment(
                        expandedAssignment === a.id ? null : a.id
                      )
                    }
                    onSupply={() => setOpenSupply(a.id)}
                    onUpdateDose={() => setOpenUpdateDose(a.id)}
                    onStop={() => setOpenStopAssign(a.id)}
                    onEditSupply={(s) => setEditSupplyRecord(s)}
                    onDeleteSupply={(id) =>
                      setDeleteSupplyId({ id, assignmentId: a.id })
                    }
                    canEdit={canEdit && patient.aktif}
                  />
                ))}
              </div>
              {assignmentTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#f0f2f5]">
                  <p className="text-xs" style={{ color: "#65676b" }}>
                    Halaman {assignmentPage + 1} daripada{" "}
                    {assignmentTotalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assignmentPage === 0}
                      onClick={() =>
                        setAssignmentPage((p) => Math.max(0, p - 1))
                      }
                      className="h-7 px-2"
                      style={{ opacity: assignmentPage === 0 ? 0.4 : 1 }}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assignmentPage >= assignmentTotalPages - 1}
                      onClick={() =>
                        setAssignmentPage((p) =>
                          Math.min(assignmentTotalPages - 1, p + 1)
                        )
                      }
                      className="h-7 px-2"
                      style={{
                        opacity:
                          assignmentPage >= assignmentTotalPages - 1 ? 0.4 : 1,
                      }}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </FoldableCard>
      </motion.div>

      {/* DIALOGS */}
      <DeactivateDialog
        open={openDeactivate}
        onOpenChange={setOpenDeactivate}
        onConfirm={() =>
          deactivatePatient.mutate(undefined, {
            onSuccess: () => setOpenDeactivate(false),
          })
        }
        isPending={deactivatePatient.isPending}
        patientName={patient.nama}
      />

      <AddAssignmentDialog
        open={openAddAssignment}
        onOpenChange={setOpenAddAssignment}
        items={itemsWithStats}
        activeItemIds={activeAssignmentItems}
        onSubmit={(data) =>
          addAssignment.mutate(data, {
            onSuccess: () => setOpenAddAssignment(false),
          })
        }
        isPending={addAssignment.isPending}
      />

      {supplyAssignment && (
        <SupplyDialog
          open={!!openSupply}
          onOpenChange={(o) => !o && setOpenSupply(null)}
          assignment={supplyAssignment}
          onSubmit={(data) =>
            supplyMut.mutate(
              {
                ...data,
                assignmentId: supplyAssignment.id,
                itemId: supplyAssignment.item_id,
              },
              {
                onSuccess: () => setOpenSupply(null),
              }
            )
          }
          isPending={supplyMut.isPending}
        />
      )}

      {updateDoseAssignment && (
        <UpdateDoseDialog
          open={!!openUpdateDose}
          onOpenChange={(o) => !o && setOpenUpdateDose(null)}
          currentDose={updateDoseAssignment.dos}
          onSubmit={(data) =>
            updateDoseMut.mutate(
              {
                ...data,
                assignmentId: updateDoseAssignment.id,
              },
              {
                onSuccess: () => setOpenUpdateDose(null),
              }
            )
          }
          isPending={updateDoseMut.isPending}
        />
      )}

      <StopAssignmentDialog
        open={!!openStopAssign}
        onOpenChange={(o) => !o && setOpenStopAssign(null)}
        onSubmit={(sebab) =>
          stopAssignment.mutate(
            { assignmentId: openStopAssign!, sebab },
            { onSuccess: () => setOpenStopAssign(null) }
          )
        }
        isPending={stopAssignment.isPending}
      />

      <EditSupplyDialog
        supply={editSupplyRecord}
        onClose={() => setEditSupplyRecord(null)}
        onSubmit={(data) =>
          updateSupplyMut.mutate(
            { ...data, assignmentId: editSupplyRecord!.assignment_id },
            { onSuccess: () => setEditSupplyRecord(null) }
          )
        }
        isPending={updateSupplyMut.isPending}
      />

      <DeleteSupplyDialog
        target={deleteSupplyId}
        onClose={() => setDeleteSupplyId(null)}
        onConfirm={() =>
          deleteSupplyMut.mutate(
            {
              supplyId: deleteSupplyId!.id,
              assignmentId: deleteSupplyId!.assignmentId,
            },
            { onSuccess: () => setDeleteSupplyId(null) }
          )
        }
        isPending={deleteSupplyMut.isPending}
      />
    </div>
  );
}

// View & Edit sub-components
function ViewInfo({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoField
          icon={User}
          label="No. Kad Pengenalan"
          value={
            patient.nombor_kad_pengenalan
              ? formatMyKad(patient.nombor_kad_pengenalan)
              : null
          }
        />
        <InfoField
          icon={User}
          label="No. Pendaftaran Hospital"
          value={patient.nombor_pendaftaran_hospital}
        />
        <InfoField
          icon={User}
          label="No. Telefon"
          value={
            patient.nombor_telefon ? formatPhone(patient.nombor_telefon) : null
          }
        />
      </div>
      <InfoField
        icon={User}
        label="Tarikh Daftar"
        value={patient.tarikh_daftar ?? ""}
      />
      <InfoField icon={User} label="Alamat" value={patient.alamat} block />
     
      {patient.catatan && (
        <InfoField
          icon={User}
          label="Catatan"
          value={patient.catatan}
          block
        />
      )}
    </div>
  );
}

function EditForm({
  editData,
  setEditData,
}: {
  editData: Partial<Patient>;
  setEditData: (v: Partial<Patient>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label style={labelStyle}>Nama *</Label>
        <Input
          value={editData.nama ?? ""}
          onChange={(e) => setEditData({ ...editData, nama: e.target.value })}
          onBlur={(e) =>
            setEditData({ ...editData, nama: toTitleCase(e.target.value) })
          }
          style={inputBaseStyle}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label style={labelStyle}>No. Kad Pengenalan</Label>
          <Input
            value={editData.nombor_kad_pengenalan ?? ""}
            onChange={(e) =>
              setEditData({ ...editData, nombor_kad_pengenalan: e.target.value })
            }
            onBlur={(e) =>
              setEditData({
                ...editData,
                nombor_kad_pengenalan: formatMyKad(e.target.value),
              })
            }
            style={inputBaseStyle}
          />
        </div>
        <div>
          <Label style={labelStyle}>No. Pendaftaran Hospital</Label>
          <Input
            value={editData.nombor_pendaftaran_hospital ?? ""}
            onChange={(e) =>
              setEditData({
                ...editData,
                nombor_pendaftaran_hospital: e.target.value,
              })
            }
            onBlur={(e) =>
              setEditData({
                ...editData,
                nombor_pendaftaran_hospital: e.target.value.toUpperCase(),
              })
            }
            style={inputBaseStyle}
          />
        </div>
        <div>
          <Label style={labelStyle}>No. Telefon</Label>
          <Input
            value={editData.nombor_telefon ?? ""}
            onChange={(e) =>
              setEditData({ ...editData, nombor_telefon: e.target.value })
            }
            onBlur={(e) =>
              setEditData({
                ...editData,
                nombor_telefon: formatPhone(e.target.value),
              })
            }
            style={inputBaseStyle}
          />
        </div>
      </div>
      <div>
        <Label style={labelStyle}>Alamat</Label>
        <textarea
          value={editData.alamat ?? ""}
          onChange={(e) =>
            setEditData({ ...editData, alamat: e.target.value })
          }
          onBlur={(e) =>
            setEditData({ ...editData, alamat: toTitleCase(e.target.value) })
          }
          className="w-full text-sm"
          style={{ ...inputBaseStyle, height: 70, padding: '8px 12px', fontFamily: 'inherit', resize: 'vertical' }}
          rows={2}
        />
      </div>
      <div>
        <Label style={labelStyle}>Catatan</Label>
        <textarea
          value={editData.catatan ?? ""}
          onChange={(e) =>
            setEditData({ ...editData, catatan: e.target.value })
          }
          className="w-full text-sm"
          style={{ ...inputBaseStyle, height: 70, padding: '8px 12px', fontFamily: 'inherit', resize: 'vertical' }}
          rows={2}
        />
      </div>
    </div>
  );
}

