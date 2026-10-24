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
import { useAuthStore } from "@/lib/auth-store";
import { friendlyDbError } from "@/lib/db-errors";
import { formatDateTime, getNowISOKL, toTitleCase } from "@/lib/utils";
import { escapeIlikeExact } from "@/lib/postgrest";
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

interface AdminAuditRow {
  id: string;
  created_at: string;
  action: string;
  details: Record<string, unknown> | null;
  actor: Pick<Profile, "id" | "nama" | "nama_pengguna"> | null;
  target: Pick<Profile, "id" | "nama" | "nama_pengguna"> | null;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  cipta_pengguna: "Cipta pengguna",
  kemas_kini_pengguna: "Kemaskini pengguna",
  tukar_status_aktif: "Aktif / Nyahaktif",
  reset_kata_laluan: "Reset kata laluan",
  selesai_permintaan_reset: "Selesai permintaan reset",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManagementPage() {
  const { profile } = useAuth();
  const sessionToken = useAuthStore((s) => s.token);
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
  // LOW-5: senarai pengguna kini berhalaman (20 sehalaman) dan bukannya
  // memaparkan keseluruhan jadual sekaligus.
  const USERS_PAGE_SIZE = 20;
  const [userPage, setUserPage] = useState(0);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery<Profile[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        // Lajur eksplisit — kata_laluan_hash tidak boleh dipilih klien
        // (sekatan lajur dalam migrasi 039).
        .select("id, nama, jawatan, nama_pengguna, peranan, aktif, created_at, updated_at, tema")
        .order("nama");
      if (error) throw error;
      return (data ?? []) as Profile[];
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

  const { data: auditLog = [], isLoading: auditLoading } = useQuery<
    AdminAuditRow[]
  >({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select(
          "id, created_at, action, details, actor:profiles!admin_audit_log_actor_id_fkey(id, nama, nama_pengguna), target:profiles!admin_audit_log_target_user_id_fkey(id, nama, nama_pengguna)"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AdminAuditRow[];
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

  // LOW-5: senarai pengguna berhalaman (20 sehalaman) dan bukannya
  // memaparkan keseluruhan jadual sekaligus.
  const userTotalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PAGE_SIZE)
  );
  const safeUserPage = Math.min(userPage, userTotalPages - 1);
  const pagedUsers = useMemo(
    () =>
      filteredUsers.slice(
        safeUserPage * USERS_PAGE_SIZE,
        safeUserPage * USERS_PAGE_SIZE + USERS_PAGE_SIZE
      ),
    [filteredUsers, safeUserPage]
  );

  const pendingCount = useMemo(
    () => resetRequests.filter((r) => r.status === "pending").length,
    [resetRequests]
  );

  // HIGH-1: pengawal klien anti-kunci-keluar (pelayan 059 menguatkuasakan).
  const isSelf = (id: string) => profile?.id === id;
  const activeAdminCount = useMemo(
    () => users.filter((u) => u.peranan === "Pentadbir" && u.aktif).length,
    [users]
  );
  const isLastActiveAdmin = (u: { id: string; peranan: string; aktif: boolean }) =>
    u.peranan === "Pentadbir" && u.aktif && activeAdminCount <= 1;

  // ── Mutations ─────────────────────────────────────────────────────────────
  // Semua endpoint /api/* yang dilindungi memerlukan Bearer token sesi.
  const authHeaders = {
    "Content-Type": "application/json",
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };

  // Jejak audit klien (060) — untuk mutasi langsung (kemas kini, tukar
  // status, selesai permintaan). Laluan pelayan (/api/create-user,
  // /api/reset-password) menulis sendiri melalui service_role.
  // Best-effort: kegagalan log tidak menggagalkan operasi utama.
  const logAdminAction = async (
    action: string,
    targetUserId: string,
    details?: Record<string, unknown>
  ) => {
    if (!profile?.id) return;
    try {
      await supabase.from("admin_audit_log").insert({
        actor_id: profile.id,
        action,
        target_user_id: targetUserId,
        details: details ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] });
    } catch {
      // Senyap — jejak audit tidak boleh menyekat operasi pentadbir.
    }
  };

  const addUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mencipta pengguna");
      }
      return res.json();
    },
    onSuccess: (data: { profile?: { id: string; nama_pengguna?: string } }) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Pengguna berjaya ditambah");
      if (data?.profile?.id) {
        void logAdminAction("cipta_pengguna", data.profile.id, {
          nama_pengguna: data.profile.nama_pengguna ?? null,
        });
      }
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
      // LOW-5: semak pendua nama_pengguna dahulu (cipta ada 409; sunting
      // sebelum ini membiarkan 23505 mentah bocor ke UI).
      if (data.nama_pengguna?.trim()) {
        const uname = data.nama_pengguna.trim();
        const { data: clash, error: clashErr } = await supabase
          .from("profiles")
          .select("id")
          .ilike("nama_pengguna", escapeIlikeExact(uname))
          .neq("id", id)
          .limit(1)
          .maybeSingle();
        if (clashErr) throw clashErr;
        if (clash) {
          throw new Error(
            `Nama pengguna "${uname}" sudah digunakan. Sila pilih yang lain.`
          );
        }
        data = { ...data, nama_pengguna: uname };
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          nama: data.nama,
          nama_pengguna: data.nama_pengguna,
          jawatan: data.jawatan,
          peranan: data.peranan,
          updated_at: getNowISOKL(),
        })
        .eq("id", id);
      if (error) {
        // Perlumbaan selit (dua suntingan serentak) — kekangan unik kekal
        // sebagai penguatkuasa terakhir.
        if ((error as { code?: string }).code === "23505") {
          throw new Error("Nama pengguna sudah digunakan. Sila pilih yang lain.");
        }
        throw error;
      }
      // NOTA: tiada panggilan supabase.auth.admin di sini — aplikasi
      // menggunakan JWT tersuai sendiri (/api/*), bukan Supabase Auth;
      // panggilan admin memerlukan service_role dan tidak boleh berjaya
      // dengan anon key klien (kod mati yang telah dibuang).
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Pengguna berjaya dikemaskini");
      void logAdminAction("kemas_kini_pengguna", variables.id, {
        medan: Object.keys(variables.data ?? {}),
      });
      setEditId(null);
      setEditData({});
    },
    onError: (err: Error) => {
      toast.error(`Gagal mengemaskini: ${friendlyDbError(err, "Gagal mengemaskini.")}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ aktif, updated_at: getNowISOKL() })
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
      void logAdminAction("tukar_status_aktif", variables.id, {
        aktif_baharu: variables.aktif,
      });
      setConfirmToggle(null);
    },
    onError: (err: Error) => {
      toast.error(`Gagal: ${friendlyDbError(err, "Operasi tidak dibenarkan.")}`);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal reset kata laluan");
      }
      return res.json() as Promise<{ tempPassword?: string }>;
    },
    onSuccess: (data) => {
      toast.success(
        data?.tempPassword
          ? `Kata laluan sementara: ${data.tempPassword} — sila salin sekarang`
          : "Kata laluan telah diset semula",
        { duration: 10000 }
      );
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
      requestedAt,
    }: {
      requestId: string;
      status: "approved" | "rejected";
      userId: string;
      /** ISO masa permintaan — untuk semakan luput (MEDIUM-1 reset). */
      requestedAt?: string | null;
    }) => {
      if (!profile?.id) {
        throw new Error("Sesi tamat tempoh. Sila log masuk semula.");
      }
      // MEDIUM-1 (audit reset): permintaan luput selepas 7 hari — keperluan
      // mungkin sudah tiada (pengguna ingat semula / bertukar). Tolak
      // kelulusan lapuk; penolakan untuk kemas fail kekal dibenarkan.
      if (status === "approved" && requestedAt) {
        const ageMs = Date.now() - new Date(requestedAt).getTime();
        if (!Number.isNaN(ageMs) && ageMs > 7 * 24 * 60 * 60 * 1000) {
          throw new Error(
            "Permintaan ini telah luput (lebih 7 hari). Minta pengguna menghantar permintaan baharu."
          );
        }
      }
      // MEDIUM-2: reset DAHULU, tandakan diluluskan KEMUDIAN. Susunan lama
      // menanda "approved" dahulu — jika reset gagal, permintaan kekal
      // diluluskan sedangkan pengguna masih tidak boleh log masuk, tanpa
      // jalan cuba-semula yang jelas (kekal "pending" + ralat dipaparkan).
      let tempPassword: string | undefined;
      if (status === "approved") {
        const res = await fetch("/api/reset-password", {
          method: "POST",
          headers: authHeaders,
          credentials: "include",
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal reset kata laluan");
        }
        // Jangan buang kata laluan sementara — pentadbir mesti
        // menyampaikannya kepada pengguna (dipaparkan sekali sahaja).
        const body = (await res.json().catch(() => ({}))) as {
          tempPassword?: string;
        };
        tempPassword = body?.tempPassword;
      }
      // Update request status (hanya selepas reset berjaya / penolakan).
      // Syarat status='pending' menjadikan peralihan idempoten — dua
      // pentadbir yang meluluskan serentak tidak memproses dua kali.
      const { data: resolved, error } = await supabase
        .from("password_reset_requests")
        .update({
          status,
          resolved_by: profile.id,
          resolved_at: getNowISOKL(),
        })
        .eq("id", requestId)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      if (!resolved || resolved.length === 0) {
        throw new Error(
          "Permintaan ini telah diselesaikan oleh pentadbir lain. Muat semula senarai."
        );
      }
      return { status, tempPassword };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reset-requests"] });
      void logAdminAction("selesai_permintaan_reset", variables.userId, {
        request_id: variables.requestId,
        keputusan: variables.status,
      });
      if (data?.status === "approved" && data?.tempPassword) {
        toast.success(
          `Diluluskan. Kata laluan sementara: ${data.tempPassword} — sila salin dan sampaikan kepada pengguna sekarang`,
          { duration: 15000 }
        );
      } else {
        toast.success(
          data?.status === "approved"
            ? "Permintaan diluluskan dan kata laluan diset semula"
            : "Permintaan ditolak"
        );
      }
    },
    onError: (err: Error) => {
      toast.error(`Gagal: ${friendlyDbError(err, "Operasi tidak dibenarkan.")}`);
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
    // Semakan dasar kata laluan di klien (pelayan mengesahkan semula).
    const pw = newUser.kata_laluan;
    if (pw.length < 8 || pw.length > 128) {
      toast.error("Kata laluan mestilah 8–128 aksara.");
      return;
    }
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
      toast.error("Kata laluan mestilah mengandungi huruf dan nombor.");
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
    const target = users.find((u) => u.id === userId);
    const newRole = editData.peranan;
    // Jangan benarkan penurunan peranan diri sendiri — minta pentadbir lain.
    if (isSelf(userId) && newRole && newRole !== "Pentadbir") {
      toast.error("Anda tidak boleh menurunkan peranan sendiri. Minta pentadbir lain melakukannya.");
      return;
    }
    // Jangan hapuskan Pentadbir aktif terakhir (pelayan 059 penguatkuasa muktamad).
    if (
      target &&
      isLastActiveAdmin(target) &&
      newRole && newRole !== "Pentadbir"
    ) {
      toast.error("Tidak boleh menurunkan Pentadbir aktif terakhir. Lantik pentadbir baharu dahulu.");
      return;
    }
    updateUserMutation.mutate({
      id: userId,
      data: { ...editData, nama: toTitleCase(editData.nama) },
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditData({});
  };

  // HIGH-1: sekat nyahaktif diri sendiri dan Pentadbir aktif terakhir
  // sebelum dialog pengesahan (pelayan 059 penguatkuasa muktamad).
  const handleToggleRequest = (user: Profile) => {
    if (isSelf(user.id) && user.aktif) {
      toast.error("Anda tidak boleh menyahaktifkan akaun sendiri. Minta pentadbir lain melakukannya.");
      return;
    }
    if (user.aktif && isLastActiveAdmin(user)) {
      toast.error("Tidak boleh menyahaktifkan Pentadbir aktif terakhir. Lantik pentadbir baharu dahulu.");
      return;
    }
    setConfirmToggle({ id: user.id, name: user.nama, newStatus: !user.aktif });
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
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl"
            style={{ background: "rgba(6, 182, 212, 0.1)" }}
          >
            <Users className="h-6 w-6" style={{ color: "#06b6d4" }} />
          </div>
          <div className="min-w-0">
            <h1
              className="truncate text-xl font-bold sm:text-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              Pengurusan
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Pusat pentadbiran sistem — pengguna, permintaan reset, rujukan
            </p>
          </div>
        </div>
        <Button
          onClick={() => setOpenAdd(true)}
          className="min-h-11 w-full text-white font-semibold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:w-auto"
          style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)" }}
        >
          <UserPlus className="h-4 w-4 mr-1.5" />
          Tambah Pengguna
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4 flex h-auto max-w-full gap-1 overflow-x-auto p-1">
          <TabsTrigger value="users" className="min-h-11 flex-shrink-0 gap-2 sm:min-h-0">
            <Users className="h-4 w-4" />
            Pengguna
          </TabsTrigger>
          <TabsTrigger value="reset-requests" className="min-h-11 flex-shrink-0 gap-2 sm:min-h-0">
            <MailQuestion className="h-4 w-4" />
            Permintaan Reset
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-2xs px-1.5 py-0">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="references" className="min-h-11 flex-shrink-0 gap-2 sm:min-h-0">
            <BookOpen className="h-4 w-4" />
            Rujukan
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-h-11 flex-shrink-0 gap-2 sm:min-h-0">
            <History className="h-4 w-4" />
            Audit
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
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(0);
                }}
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
              <div className="overflow-x-auto" role="region" aria-label="Jadual pengguna — berhalaman" tabIndex={0}>
                <table className="w-full min-w-[760px]">
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
                    {pagedUsers.map((user, idx) => (
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
                        onToggleActive={() => handleToggleRequest(user)}
                        isSelf={profile?.id === user.id}
                        isLastAdmin={isLastActiveAdmin({ id: user.id, peranan: user.peranan, aktif: user.aktif })}
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
            {userTotalPages > 1 && (
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: "1px solid var(--border-light)" }}
              >
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Halaman {safeUserPage + 1} / {userTotalPages} ({filteredUsers.length} pengguna)
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safeUserPage === 0}
                    onClick={() => setUserPage(safeUserPage - 1)}
                    className="min-h-10"
                  >
                    Sebelum
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={safeUserPage >= userTotalPages - 1}
                    onClick={() => setUserPage(safeUserPage + 1)}
                    className="min-h-10"
                  >
                    Seterus
                  </Button>
                </div>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                            className="h-6 w-6"
                            style={{ color: "#d97706" }}
                          />
                        ) : req.status === "approved" ? (
                          <UserCheck
                            className="h-6 w-6"
                            style={{ color: "#42b72a" }}
                          />
                        ) : (
                          <UserX
                            className="h-6 w-6"
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
                          {(() => {
                            const ageMs =
                              Date.now() - new Date(req.requested_at).getTime();
                            if (req.status !== "pending" || Number.isNaN(ageMs)) return null;
                            const days = Math.floor(ageMs / 86400000);
                            const stale = ageMs > 7 * 86400000;
                            return (
                              <span
                                className="ml-1 inline-block rounded-full px-2 py-0.5 text-2xs font-semibold"
                                style={
                                  stale
                                    ? { background: "rgba(220,38,38,0.10)", color: "#b91c1b" }
                                    : { background: "rgba(107,114,128,0.12)", color: "#4b5563" }
                                }
                                title={stale ? "Melebihi 7 hari — minta pengguna hantar semula" : undefined}
                              >
                                {stale ? "TELAH LUPUT" : days <= 0 ? "Hari ini" : `${days} hari lalu`}
                              </span>
                            );
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                                requestedAt: req.requested_at,
                              })
                            }
                            disabled={resolveRequestMutation.isPending}
                            style={{ background: "#42b72a" }}
                            className="min-h-11 text-white text-xs sm:min-h-0"
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
                                requestedAt: req.requested_at,
                              })
                            }
                            disabled={resolveRequestMutation.isPending}
                            className="min-h-11 text-xs sm:min-h-0"
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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: Audit Log (060 — jejak tindakan pentadbir, 100 terkini)      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="audit">
          <Card className="overflow-hidden">
            {auditLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
            ) : auditLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <History
                  className="h-10 w-10 mb-3"
                  style={{ color: "var(--text-secondary)" }}
                />
                <p className="text-sm font-medium">Tiada rekod audit.</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Tindakan pentadbir akan direkodkan di sini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Masa</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Pelaku</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Tindakan</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Sasaran</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>Butiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: "var(--text-secondary)" }}>
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="px-4 py-2.5">{row.actor?.nama ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary">
                            {AUDIT_ACTION_LABELS[row.action] ?? row.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">{row.target?.nama ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                          {row.details ? JSON.stringify(row.details) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* DIALOG: Tambah Pengguna Baharu                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-sm:max-h-[calc(100dvh-1.5rem)]">
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
                value={newUser.kata_laluan}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder="8–128 aksara, huruf + nombor"
                onChange={(e) =>
                  setNewUser({ ...newUser, kata_laluan: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Jawatan</Label>
              <Input
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
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <option value="Pentadbir">Pentadbir</option>
                <option value="Penjaga Stor">Penjaga Stor</option>
                <option value="Kakitangan Farmasi">Kakitangan Farmasi</option>
                <option value="Kakitangan Klinik">Kakitangan Klinik</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)} className="min-h-11 sm:min-h-0">
              Batal
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={addUserMutation.isPending}
              style={{ background: "#1877f2" }}
              className="min-h-11 text-white sm:min-h-0"
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
                  Kata laluan sementara rawak akan dijana dan dipaparkan sekali
                  sahaja — sila salin sejurus selepas reset
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
  /** HIGH-1: baris akaun sendiri — butang berbahaya dilumpuhkan. */
  isSelf: boolean;
  /** HIGH-1: Pentadbir aktif terakhir — nyahaktif disekat. */
  isLastAdmin: boolean;
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
  isSelf,
  isLastAdmin,
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
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
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
                        className="grid grid-cols-1 gap-3 md:grid-cols-4"
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
                            onBlur={() =>
                              onEditDataChange({
                                ...editData,
                                nama: toTitleCase(editData.nama),
                              })
                            }
                            className="h-10 text-sm"
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
                            className="h-10 text-sm"
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
                            className="h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Peranan</Label>
                          <select
                            value={editData.peranan || ""}
                            disabled={isSelf}
                            title={isSelf ? "Peranan sendiri tidak boleh diubah — minta pentadbir lain" : undefined}
                            onChange={(e) =>
                              onEditDataChange({
                                ...editData,
                                peranan: e.target.value as Profile["peranan"],
                              })
                            }
                             className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
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
                         <div className="md:col-span-4 flex flex-col gap-2 mt-2 sm:flex-row">
                          <Button
                            size="sm"
                            onClick={onSaveEdit}
                            style={{ background: "#1877f2" }}
                             className="min-h-11 text-white sm:min-h-0"
                          >
                            Simpan Perubahan
                          </Button>
                          <Button
                            size="sm"
                             variant="outline"
                            onClick={onCancelEdit}
                            className="min-h-11 sm:min-h-0"
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 sm:min-h-0"
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
                          className={`min-h-11 sm:min-h-0 ${!user.aktif ? "text-white" : ""}`}
                          disabled={(isSelf || isLastAdmin) && user.aktif}
                          title={
                            isSelf && user.aktif
                              ? "Akaun sendiri tidak boleh dinyahaktifkan — minta pentadbir lain"
                              : isLastAdmin && user.aktif
                                ? "Pentadbir aktif terakhir tidak boleh dinyahaktifkan"
                                : undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleActive();
                          }}
                          style={
                            !user.aktif ? { background: "#42b72a" } : undefined
                          }
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
                            className="min-h-11 sm:min-h-0"
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
