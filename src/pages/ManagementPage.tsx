/**
 * ManagementPage — Halaman Pentadbiran Pengguna
 * Pusat kawalan pentadbiran sistem — eksklusif untuk Pentadbir sahaja.
 *
 * Tiga tab:
 * 1. Pengguna — CRUD pengguna, tukar status aktif, reset kata laluan
 * 2. Permintaan Reset — Lulus/tolak permintaan dari halaman Lupa Kata Laluan
 * 3. Rujukan — Urus data rujukan (kategori item, bentuk dos, durasi bekalan)
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, toTitleCase } from "@/lib/utils";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/layout/breadcrumb";

// Icons
import {
  Users,
  UserPlus,
  ChevronDown,
  Edit,
  UserX,
  UserCheck,
  KeyRound,
  ShieldAlert,
  AlertTriangle,
  Lock,
  MailQuestion,
  BookOpen,
  History,
  BellRing,
} from "lucide-react";

// Lookup Manager
import LookupManager from "@/components/pengurusan/lookup-manager";

// Types
import type { Profile, PasswordResetRequest } from "@/types";

// ─── Joined reset request type ────────────────────────────────────────────────
interface ResetRequestWithProfile extends PasswordResetRequest {
  profiles: Pick<Profile, "id" | "nama" | "nama_pengguna"> | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManagementPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.peranan === "Pentadbir";

  // ── Page Title ────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = "Pengurusan — QuickRxRecord";
  }, []);

  // ── Local State (9 variables) ─────────────────────────────────────────────
  const [openAdd, setOpenAdd] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    nama: "",
    nama_pengguna: "",
    kata_laluan: "",
    jawatan: "",
    peranan: "Kakitangan Farmasi" as string,
  });
  const [editData, setEditData] = useState<Partial<Profile>>({});
  const [confirmToggle, setConfirmToggle] = useState<{
    id: string;
    name: string;
    newStatus: boolean;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState<{
    id: string;
    name: string;
    nama_pengguna: string;
  } | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery<Profile[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("nama");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: resetRequests = [], isLoading: requestsLoading } =
    useQuery<ResetRequestWithProfile[]>({
      queryKey: ["reset-requests"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("password_reset_requests")
          .select("*, profiles:user_id(id, nama, nama_pengguna)")
          .order("requested_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as ResetRequestWithProfile[];
      },
      enabled: isAdmin,
    });

  // ── Derived Values ────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.nama.toLowerCase().includes(q) ||
        u.nama_pengguna.toLowerCase().includes(q) ||
        (u.jawatan && u.jawatan.toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const pendingCount = useMemo(
    () => resetRequests.filter((r) => r.status === "pending").length,
    [resetRequests]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mencipta pengguna");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Pengguna berjaya ditambah");
      setOpenAdd(false);
      setNewUser({
        nama: "",
        nama_pengguna: "",
        kata_laluan: "",
        jawatan: "",
        peranan: "Kakitangan Farmasi",
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Profile>;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          nama: data.nama,
          nama_pengguna: data.nama_pengguna,
          jawatan: data.jawatan,
          peranan: data.peranan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;

      // If nama_pengguna changed, try to update auth user too
      if (data.nama_pengguna) {
        try {
          await supabase.auth.admin.updateUserById(id, {
            user_metadata: { nama_pengguna: data.nama_pengguna },
          });
        } catch {
          // Auth update may fail with custom RLS — ignore silently
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Pengguna berjaya dikemaskini");
      setEditId(null);
      setEditData({});
    },
    onError: (err: Error) => {
      toast.error(`Gagal mengemaskini: ${err.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ aktif, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(
        variables.aktif
          ? "Pengguna berjaya diaktifkan"
          : "Pengguna berjaya dinyahaktifkan"
      );
      setConfirmToggle(null);
    },
    onError: (err: Error) => {
      toast.error(`Gagal: ${err.message}`);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal reset kata laluan");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Kata laluan telah diset semula ke password123");
      setConfirmReset(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resolveRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      userId,
    }: {
      requestId: string;
      status: "approved" | "rejected";
      userId: string;
    }) => {
      // Update request status
      const { error } = await supabase
        .from("password_reset_requests")
        .update({
          status,
          resolved_by: profile?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;

      // If approved, also reset the password
      if (status === "approved") {
        const res = await fetch("/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal reset kata laluan");
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reset-requests"] });
      toast.success(
        variables.status === "approved"
          ? "Permintaan diluluskan dan kata laluan diset semula"
          : "Permintaan ditolak"
      );
    },
    onError: (err: Error) => {
      toast.error(`Gagal: ${err.message}`);
    },
  });

  // ── Access Control ────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <ShieldAlert className="h-16 w-16 mb-4" style={{ color: "var(--text-secondary)" }} />
        <h2 className="text-lg font-semibold mb-2">Akses Ditolak</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Anda tidak mempunyai akses ke halaman ini.
        </p>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddUser = () => {
    if (!newUser.nama.trim() || !newUser.nama_pengguna.trim() || !newUser.kata_laluan.trim()) {
      toast.error("Sila isi semua medan wajib");
      return;
    }
    addUserMutation.mutate(newUser);
  };

  const handleEditUser = (user: Profile) => {
    setEditId(user.id);
    setEditData({
      nama: user.nama,
      nama_pengguna: user.nama_pengguna,
      jawatan: user.jawatan || "",
      peranan: user.peranan,
    });
  };

  const handleSaveEdit = (userId: string) => {
    updateUserMutation.mutate({ id: userId, data: editData });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({});
  };

  const toggleExpand = (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setEditId(null);
      setEditData({});
    } else {
      setExpandedUser(userId);
      setEditId(null);
      setEditData({});
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Decorative orb */}
      <div
        className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "#06b6d4" }}
      />

      <Breadcrumb items={[{ label: "Pengurusan" }]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
            style={{ background: "rgba(6, 182, 212, 0.1)" }}
          >
            <Users className="h-6 w-6" style={{ color: "#06b6d4" }} />
          </div>
          <div>
            <h1
              className="text-[22px] font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Pengurusan
            </h1>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Pusat pentadbiran sistem — pengguna, permintaan reset, rujukan
            </p>
          </div>
        </div>
        <Button
          onClick={() => setOpenAdd(true)}
          className="text-white font-semibold"
          style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)", boxShadow: "0 2px 8px rgba(24,119,242,0.2)" }}
        >
          <UserPlus className="h-4 w-4 mr-1.5" />
          Tambah Pengguna
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Pengguna
          </TabsTrigger>
          <TabsTrigger value="reset-requests" className="gap-2">
            <MailQuestion className="h-4 w-4" />
            Permintaan Reset
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-2xs px-1.5 py-0">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="references" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Rujukan
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Pengguna                                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="users">
          <Card className="overflow-hidden">
            {/* Search */}
            <div className="p-4 border-b" style={{ borderColor: "var(--border-light)" }}>
              <Input
                placeholder="Cari pengguna..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div
                className="text-center py-12 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Tiada pengguna didaftarkan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {["", "Nama", "Nama Pengguna", "Jawatan", "Peranan", "Status"].map(
                        (header) => (
                          <th
                            key={header}
                            className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider"
                            style={{
                              color: "var(--text-secondary)",
                              borderBottom: "2px solid var(--border-medium)",
                              background: "var(--bg-secondary)",
                            }}
                          >
                            {header}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, idx) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        idx={idx}
                        isExpanded={expandedUser === user.id}
                        editId={editId}
                        editData={editData}
                        onToggle={() => toggleExpand(user.id)}
                        onEdit={() => handleEditUser(user)}
                        onSaveEdit={() => handleSaveEdit(user.id)}
                        onCancelEdit={handleCancelEdit}
                        onEditDataChange={setEditData}
                        onToggleActive={() =>
                          setConfirmToggle({
                            id: user.id,
                            name: user.nama,
                            newStatus: !user.aktif,
                          })
                        }
                        onResetPassword={() =>
                          setConfirmReset({
                            id: user.id,
                            name: user.nama,
                            nama_pengguna: user.nama_pengguna,
                          })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: Permintaan Reset                                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="reset-requests">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : resetRequests.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <BellRing
                className="h-12 w-12 mb-3"
                style={{ color: "#d9d9d9" }}
              />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Tiada permintaan.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {resetRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border p-4 transition-colors"
                  style={{
                    background:
                      req.status === "pending" ? "rgba(217,119,6,0.08)" : "var(--card)",
                    borderColor:
                      req.status === "pending" ? "rgba(217,119,6,0.25)" : "var(--border-light)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                        style={{
                          background:
                            req.status === "pending"
                              ? "rgba(217, 119, 6, 0.1)"
                              : "rgba(101, 103, 107, 0.1)",
                        }}
                      >
                        {req.status === "pending" ? (
                          <History
                            className="h-5 w-5"
                            style={{ color: "#d97706" }}
                          />
                        ) : req.status === "approved" ? (
                          <UserCheck
                            className="h-5 w-5"
                            style={{ color: "#42b72a" }}
                          />
                        ) : (
                          <UserX
                            className="h-5 w-5"
                            style={{ color: "#e41e3f" }}
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {req.profiles?.nama ?? "Pengguna Tidak Diketahui"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          @{req.profiles?.nama_pengguna ?? "—"} ·{" "}
                          {formatDateTime(req.requested_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          req.status === "pending"
                            ? "destructive"
                            : req.status === "approved"
                            ? "success"
                            : "secondary"
                        }
                      >
                        {req.status === "pending"
                          ? "Menunggu"
                          : req.status === "approved"
                          ? "Disahkan"
                          : "Ditolak"}
                      </Badge>
                      {req.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() =>
                              resolveRequestMutation.mutate({
                                requestId: req.id,
                                status: "approved",
                                userId: req.user_id,
                              })
                            }
                            disabled={resolveRequestMutation.isPending}
                            style={{ background: "#42b72a" }}
                            className="text-white text-xs"
                          >
                            <CheckCircle2Icon className="h-3.5 w-3.5 mr-1" />
                            Sah & Reset
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              resolveRequestMutation.mutate({
                                requestId: req.id,
                                status: "rejected",
                                userId: req.user_id,
                              })
                            }
                            disabled={resolveRequestMutation.isPending}
                            className="text-xs"
                          >
                            <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                            Tolak
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: Rujukan                                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="references">
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
            <LookupManager type="item_categories" />
            <LookupManager type="item_forms" />
            <LookupManager type="supply_durations" />
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG: Tambah Pengguna Baharu                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" style={{ color: "#06b6d4" }} />
              Tambah Pengguna Baharu
            </DialogTitle>
            <DialogDescription>
              Cipta akaun pengguna baharu dalam sistem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                Nama <span style={{ color: "#e41e3f" }}>*</span>
              </Label>
              <Input
                placeholder="Nama penuh"
                value={newUser.nama}
                onChange={(e) =>
                  setNewUser({ ...newUser, nama: e.target.value })
                }
                onBlur={() =>
                  setNewUser((prev) => ({
                    ...prev,
                    nama: toTitleCase(prev.nama),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Nama Pengguna <span style={{ color: "#e41e3f" }}>*</span>
              </Label>
              <Input
                placeholder="Nama pengguna untuk log masuk"
                value={newUser.nama_pengguna}
                onChange={(e) =>
                  setNewUser({ ...newUser, nama_pengguna: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Kata Laluan <span style={{ color: "#e41e3f" }}>*</span>
              </Label>
              <Input
                type="password"
                placeholder="Kata laluan"
                value={newUser.kata_laluan}
                onChange={(e) =>
                  setNewUser({ ...newUser, kata_laluan: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Jawatan</Label>
              <Input
                placeholder="Jawatan (cth: Juruteknik Farmasi)"
                value={newUser.jawatan}
                onChange={(e) =>
                  setNewUser({ ...newUser, jawatan: e.target.value })
                }
                onBlur={() =>
                  setNewUser((prev) => ({
                    ...prev,
                    jawatan: toTitleCase(prev.jawatan),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Peranan <span style={{ color: "#e41e3f" }}>*</span>
              </Label>
              <select
                value={newUser.peranan}
                onChange={(e) =>
                  setNewUser({ ...newUser, peranan: e.target.value })
                }
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <option value="Pentadbir">Pentadbir</option>
                <option value="Penjaga Stor">Penjaga Stor</option>
                <option value="Kakitangan Farmasi">Kakitangan Farmasi</option>
                <option value="Kakitangan Klinik">Kakitangan Klinik</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>
              Batal
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={addUserMutation.isPending}
              style={{ background: "#1877f2" }}
              className="text-white"
            >
              {addUserMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG: Nyahaktifkan/Aktifkan Pengguna                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={!!confirmToggle}
        onOpenChange={() => setConfirmToggle(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmToggle?.newStatus ? (
                <>
                  <UserCheck className="h-5 w-5" style={{ color: "#42b72a" }} />
                  Aktifkan Semula Pengguna
                </>
              ) : (
                <>
                  <ShieldAlert
                    className="h-5 w-5"
                    style={{ color: "#d97706" }}
                  />
                  Nyahaktifkan Pengguna
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div
              className="rounded-lg p-3 text-sm"
              style={{
                background: confirmToggle?.newStatus ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                color: confirmToggle?.newStatus ? "var(--success)" : "var(--destructive)",
              }}
            >
              <p className="font-semibold mb-2">
                {confirmToggle?.newStatus
                  ? `Aktifkan semula "${confirmToggle?.name}"?`
                  : `Nyahaktifkan "${confirmToggle?.name}"?`}
              </p>
              <ul className="space-y-1 list-disc list-inside text-xs">
                {confirmToggle?.newStatus ? (
                  <>
                    <li>Pengguna boleh log masuk semula ke sistem</li>
                    <li>Data pengguna tidak berubah</li>
                  </>
                ) : (
                  <>
                    <li>Pengguna tidak akan dapat log masuk</li>
                    <li>Data akan kekal dalam pangkalan data</li>
                    <li>Boleh diaktifkan semula bila-bila masa</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (confirmToggle) {
                  toggleActiveMutation.mutate({
                    id: confirmToggle.id,
                    aktif: confirmToggle.newStatus,
                  });
                }
              }}
              disabled={toggleActiveMutation.isPending}
              style={
                confirmToggle?.newStatus
                  ? { background: "#42b72a" }
                  : undefined
              }
              variant={confirmToggle?.newStatus ? undefined : "destructive"}
              className={confirmToggle?.newStatus ? "text-white" : ""}
            >
              {toggleActiveMutation.isPending
                ? "Memproses..."
                : confirmToggle?.newStatus
                ? "Ya, Aktifkan"
                : "Ya, Nyahaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG: Reset Kata Laluan                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={!!confirmReset}
        onOpenChange={() => setConfirmReset(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" style={{ color: "#d97706" }} />
              Reset Kata Laluan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div
              className="rounded-lg p-3 text-sm"
              style={{ background: "rgba(217,119,6,0.08)", color: "var(--warning)" }}
            >
              <p className="font-semibold mb-2">
                Set semula kata laluan untuk "{confirmReset?.name}"?
              </p>
              <ul className="space-y-1 list-disc list-inside text-xs">
                <li>
                  Kata laluan baharu: <strong>password123</strong>
                </li>
                <li>Pengguna akan dipaksa log masuk semula</li>
                <li>Tindakan ini tidak boleh dibatalkan</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (confirmReset) {
                  resetPasswordMutation.mutate(confirmReset.id);
                }
              }}
              disabled={resetPasswordMutation.isPending}
              style={{ background: "#d97706" }}
              className="text-white"
            >
              {resetPasswordMutation.isPending
                ? "Menyimpan..."
                : "Ya, Set Semula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Inline Icon Aliases ──────────────────────────────────────────────────────
function CheckCircle2Icon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function XCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

// ─── UserRow Component ────────────────────────────────────────────────────────
interface UserRowProps {
  user: Profile;
  idx: number;
  isExpanded: boolean;
  editId: string | null;
  editData: Partial<Profile>;
  onToggle: () => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditDataChange: (data: Partial<Profile>) => void;
  onToggleActive: () => void;
  onResetPassword: () => void;
}

function UserRow({
  user,
  idx,
  isExpanded,
  editId,
  editData,
  onToggle,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onEditDataChange,
  onToggleActive,
  onResetPassword,
}: UserRowProps) {
  const isEditing = editId === user.id;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors"
        style={{
          background: isExpanded
            ? "var(--bg-secondary)"
            : idx % 2 === 1
            ? "var(--bg-secondary)"
            : "var(--card)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <td className="px-3 py-3">
          <div
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.1s" }}
          >
            <ChevronDown
              className="h-4 w-4"
              style={{ color: "var(--text-secondary)" }}
            />
          </div>
        </td>
        <td className="px-3 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{user.nama}</td>
        <td
          className="px-3 py-3 text-sm"
          style={{ fontFamily: "monospace", fontSize: "14px", color: "var(--text-primary)" }}
        >
          {user.nama_pengguna}
        </td>
        <td className="px-3 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          {user.jawatan || "—"}
        </td>
        <td className="px-3 py-3 text-sm">
          <Badge variant="secondary">{user.peranan}</Badge>
        </td>
        <td className="px-3 py-3 text-sm">
          <Badge variant={user.aktif ? "success" : "destructive"}>
            {user.aktif ? "Aktif" : "Tidak Aktif"}
          </Badge>
        </td>
      </tr>

      {/* Expanded Panel */}
        {isExpanded && (
          <tr>
            <td colSpan={6}>
              <div
                className="overflow-hidden"
              >
                <div
                  className="px-6 py-4"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  {/* User Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Nama Pengguna
                      </p>
                      <p className="text-sm font-medium">
                        {user.nama_pengguna}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Didaftarkan
                      </p>
                      <p className="text-sm font-medium">
                        {formatDateTime(user.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Kemaskini
                      </p>
                      <p className="text-sm font-medium">
                        {formatDateTime(user.updated_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Peranan
                      </p>
                      <p className="text-sm font-medium">{user.peranan}</p>
                    </div>
                  </div>

                  {/* Edit Form OR Action Buttons */}
                    {isEditing ? (
                      <div
                        className="grid grid-cols-1 md:grid-cols-4 gap-3"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs">Nama</Label>
                          <Input
                            value={editData.nama || ""}
                            onChange={(e) =>
                              onEditDataChange({
                                ...editData,
                                nama: e.target.value,
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Nama Pengguna</Label>
                          <Input
                            value={editData.nama_pengguna || ""}
                            onChange={(e) =>
                              onEditDataChange({
                                ...editData,
                                nama_pengguna: e.target.value,
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Jawatan</Label>
                          <Input
                            value={editData.jawatan || ""}
                            onChange={(e) =>
                              onEditDataChange({
                                ...editData,
                                jawatan: e.target.value,
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Peranan</Label>
                          <select
                            value={editData.peranan || ""}
                            onChange={(e) =>
                              onEditDataChange({
                                ...editData,
                                peranan: e.target.value as Profile["peranan"],
                              })
                            }
                            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                          >
                            <option value="Pentadbir">Pentadbir</option>
                            <option value="Penjaga Stor">Penjaga Stor</option>
                            <option value="Kakitangan Farmasi">
                              Kakitangan Farmasi
                            </option>
                            <option value="Kakitangan Klinik">
                              Kakitangan Klinik
                            </option>
                          </select>
                        </div>
                        <div className="md:col-span-4 flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={onSaveEdit}
                            style={{ background: "#1877f2" }}
                            className="text-white"
                          >
                            Simpan Perubahan
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onCancelEdit}
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex gap-2"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                          }}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={user.aktif ? "destructive" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleActive();
                          }}
                          style={
                            !user.aktif ? { background: "#42b72a" } : undefined
                          }
                          className={!user.aktif ? "text-white" : ""}
                        >
                          {user.aktif ? (
                            <>
                              <UserX className="h-3.5 w-3.5 mr-1" />
                              Nyahaktif
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Aktif
                            </>
                          )}
                        </Button>
                        {user.peranan !== "Pentadbir" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onResetPassword();
                            }}
                            style={{ color: "#d97706", borderColor: "#d97706" }}
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            Reset Kata Laluan
                          </Button>
                        )}
                      </div>
                    )}
                </div>
              </div>
            </td>
          </tr>
        )}
    </>
  );
}