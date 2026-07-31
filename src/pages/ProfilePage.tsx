import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  ArrowLeft,
  User,
  Lock,
  KeyRound,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/lib/auth-store";
import { supabase } from "@/lib/supabase";
import { toTitleCase } from "@/lib/utils";

// ============================================================================
// Style definitions
// ============================================================================

const cardBaseStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: "16px",
  padding: "20px 24px",
  background: "var(--card)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};



const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "42px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid #dddfe2",
  background: "#fff",
  fontSize: "14px",
  fontWeight: 500,
  color: "var(--text-primary)",
  outline: "none",
  transition: "all 0.2s ease",
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "#1877f2",
  boxShadow: "0 0 0 3px rgba(24, 119, 242, 0.1)",
};

// ============================================================================
// Gradient constants
// ============================================================================



// ============================================================================
// Types
// ============================================================================

interface EditData {
  nama: string;
  jawatan: string;
  nama_pengguna: string;
}

interface PasswordData {
  current: string;
  newPwd: string;
  confirm: string;
}

// ============================================================================
// Component
// ============================================================================

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── State ───────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<EditData>({
    nama: "",
    jawatan: "",
    nama_pengguna: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwd, setPwd] = useState<PasswordData>({
    current: "",
    newPwd: "",
    confirm: "",
  });
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ── Refs for auto-focus ─────────────────────────────────────────────────
  const namaInputRef = useRef<HTMLInputElement>(null);
  const currentPwdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && namaInputRef.current) {
      namaInputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (changingPassword && currentPwdRef.current) {
      currentPwdRef.current.focus();
    }
  }, [changingPassword]);

  // ── Mutations ───────────────────────────────────────────────────────────
  const updateProfileMutation = useMutation({
    mutationFn: async (data: EditData) => {
      if (!profile) throw new Error("Profil tidak dijumpai");
      const { error } = await supabase
        .from("profiles")
        .update({
          nama: data.nama,
          jawatan: data.jawatan,
          nama_pengguna: data.nama_pengguna,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profil berjaya dikemaskini.");
      setEditing(false);
      await refreshProfile();
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Gagal mengemas kini profil.");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordData) => {
      if (!token) throw new Error("Sesi tidak sah");
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: data.current,
          new_password: data.newPwd,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menukar kata laluan.");
      return result;
    },
    onSuccess: () => {
      toast.success("Kata laluan berjaya dikemaskini.");
      setChangingPassword(false);
      setPwd({ current: "", newPwd: "", confirm: "" });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Gagal menukar kata laluan.");
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────
  const startEdit = () => {
    if (!profile) return;
    setEditData({
      nama: profile.nama,
      jawatan: profile.jawatan || "",
      nama_pengguna: profile.nama_pengguna,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = () => {
    if (!editData.nama.trim()) {
      toast.error("Nama tidak boleh kosong.");
      return;
    }
    if (!editData.nama_pengguna.trim()) {
      toast.error("Nama pengguna tidak boleh kosong.");
      return;
    }
    updateProfileMutation.mutate(editData);
  };

  const handleChangePassword = () => {
    if (!pwd.current) {
      toast.error("Sila masukkan kata laluan semasa.");
      return;
    }
    if (pwd.newPwd.length < 6) {
      toast.error("Kata laluan baharu mestilah sekurang-kurangnya 6 aksara.");
      return;
    }
    if (pwd.newPwd !== pwd.confirm) {
      toast.error("Kata laluan baharu tidak sepadan.");
      return;
    }
    changePasswordMutation.mutate(pwd);
  };

  const toggleChangingPassword = () => {
    setChangingPassword((prev) => !prev);
    if (changingPassword) {
      setPwd({ current: "", newPwd: "", confirm: "" });
    }
  };

  // ── Password strength ───────────────────────────────────────────────────
  const getPasswordStrength = (password: string): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: "", color: "transparent" };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: "Lemah", color: "#ef4444" };
    if (score <= 2) return { level: 2, label: "Sederhana", color: "#f59e0b" };
    if (score <= 3) return { level: 3, label: "Baik", color: "#22c55e" };
    return { level: 4, label: "Kuat", color: "#16a34a" };
  };

  const pwdStrength = getPasswordStrength(pwd.newPwd);

  // ── Guard ───────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      <Breadcrumb items={[{ label: "Profil Pengguna" }]} />

      {/* Header */}
      <div
        style={{ marginBottom: 20 }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.3,
          }}
        >
          Profil Pengguna
        </h1>
        <p
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: "var(--text-secondary)",
            marginTop: 4,
          }}
        >
          Lihat dan kemaskini maklumat peribadi anda
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Kad Tukar Kata Laluan                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div
        style={{ ...cardBaseStyle, marginBottom: 20, overflow: "hidden" }}
      >
        {/* Card header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "rgba(34, 197, 94, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={16} style={{ color: "#22c55e" }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Maklumat Peribadi
              </h2>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--text-secondary)",
                  marginTop: 1,
                }}
              >
                Butiran akaun anda
              </p>
            </div>
          </div>

          {/* Edit/Save/Cancel buttons */}
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              title="Edit maklumat profil"
              aria-label="Edit Profil"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #1877f2",
                background: "transparent",
                color: "#1877f2",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-accent-blue)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Edit Profil
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={cancelEdit}
                title="Batal edit profil"
                aria-label="Batal edit"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid #dddfe2",
                  background: "#fff",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#bec3c9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveEdit}
                title="Simpan perubahan profil"
                aria-label="Simpan profil"
                disabled={updateProfileMutation.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: updateProfileMutation.isPending ? "not-allowed" : "pointer",
                  opacity: updateProfileMutation.isPending ? 0.7 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {updateProfileMutation.isPending ? (
                  <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Save size={14} />
                )}
                {updateProfileMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          )}
        </div>

        {/* Fields — Read or Edit mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!editing ? (
            // ── Read mode ──────────────────────────────────────────────
            <>
              <FieldDisplay label="NAMA" value={toTitleCase(profile.nama)} />
              <FieldDisplay label="NAMA PENGGUNA" value={`@${profile.nama_pengguna}`} />
              <FieldDisplay label="JAWATAN" value={profile.jawatan || "—"} />
              <FieldDisplay label="PERANAN" value={profile.peranan} />
            </>
          ) : (
            // ── Edit mode ──────────────────────────────────────────────
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Nama
                </label>
                <input
                  ref={namaInputRef}
                  type="text"
                  value={editData.nama}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, nama: e.target.value }))
                  }
                  onBlur={(e) => {
                    setEditData((prev) => ({
                      ...prev,
                      nama: toTitleCase(e.target.value),
                    }));
                  }}
                  style={focusedField === "edit-nama" ? inputFocusStyle : inputStyle}
                  onFocus={() => setFocusedField("edit-nama")}
                  onBlurCapture={() => setFocusedField(null)}
                  placeholder="Nama penuh"
                  aria-label="Nama penuh"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Nama Pengguna
                </label>
                <input
                  type="text"
                  value={editData.nama_pengguna}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      nama_pengguna: e.target.value,
                    }))
                  }
                  style={
                    focusedField === "edit-username"
                      ? inputFocusStyle
                      : inputStyle
                  }
                  onFocus={() => setFocusedField("edit-username")}
                  placeholder="nama_pengguna"
                  aria-label="Nama pengguna"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Jawatan
                </label>
                <input
                  type="text"
                  value={editData.jawatan}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, jawatan: e.target.value }))
                  }
                  style={
                    focusedField === "edit-jawatan"
                      ? inputFocusStyle
                      : inputStyle
                  }
                  onFocus={() => setFocusedField("edit-jawatan")}
                  placeholder="Jawatan"
                  aria-label="Jawatan"
                />
              </div>
            </>
          )}
        </div>

        {/* Success indicator */}
        {updateProfileMutation.isSuccess && !editing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 14,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(34, 197, 94, 0.08)",
              color: "#16a34a",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Check size={14} />
            Profil berjaya dikemaskini
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Kad Tukar Kata Laluan                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div
        style={{ ...cardBaseStyle, overflow: "hidden" }}
      >
        {/* Card header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: changingPassword ? 16 : 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "rgba(245, 158, 11, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={16} style={{ color: "#f59e0b" }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Tukar Kata Laluan
            </h2>
            <p
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "var(--text-secondary)",
                marginTop: 1,
              }}
            >
              Kemas kini kata laluan akaun anda
            </p>
          </div>

          {!changingPassword && (
            <button
              type="button"
              onClick={toggleChangingPassword}
              title="Tukar kata laluan"
              aria-label="Tukar Kata Laluan"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <KeyRound size={14} />
              Tukar Kata Laluan
            </button>
          )}
        </div>

        {/* Expanded password form */}
        {changingPassword && (
          <div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Current password */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Kata Laluan Semasa
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    ref={currentPwdRef}
                    type={showCurrentPwd ? "text" : "password"}
                    value={pwd.current}
                    onChange={(e) =>
                      setPwd((prev) => ({ ...prev, current: e.target.value }))
                    }
                    style={
                      focusedField === "pwd-current"
                        ? { ...inputFocusStyle, paddingRight: 40 }
                        : { ...inputStyle, paddingRight: 40 }
                    }
                    onFocus={() => setFocusedField("pwd-current")}
                    placeholder="Masukkan kata laluan semasa"
                    aria-label="Kata laluan semasa"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd((p) => !p)}
                    title="Tunjuk/sembunyi kata laluan semasa"
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                    aria-label={showCurrentPwd ? "Sembunyikan kata laluan semasa" : "Tunjukkan kata laluan semasa"}
                  >
                    {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Kata Laluan Baharu
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPwd ? "text" : "password"}
                    value={pwd.newPwd}
                    onChange={(e) =>
                      setPwd((prev) => ({ ...prev, newPwd: e.target.value }))
                    }
                    style={
                      focusedField === "pwd-new"
                        ? { ...inputFocusStyle, paddingRight: 40 }
                        : { ...inputStyle, paddingRight: 40 }
                    }
                    onFocus={() => setFocusedField("pwd-new")}
                    placeholder="Sekurang-kurangnya 6 aksara"
                    aria-label="Kata laluan baharu"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd((p) => !p)}
                    title="Tunjuk/sembunyi kata laluan baharu"
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                    aria-label={showNewPwd ? "Sembunyikan kata laluan baharu" : "Tunjukkan kata laluan baharu"}
                  >
                    {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password strength meter */}
                {pwd.newPwd && (
                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        marginBottom: 4,
                      }}
                    >
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            background:
                              i <= pwdStrength.level
                                ? pwdStrength.color
                                : "var(--border-medium)",
                            transition: "background 0.2s ease",
                          }}
                        />
                      ))}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: pwdStrength.color,
                      }}
                    >
                      {pwdStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  Sahkan Kata Laluan Baharu
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPwd ? "text" : "password"}
                    value={pwd.confirm}
                    onChange={(e) =>
                      setPwd((prev) => ({ ...prev, confirm: e.target.value }))
                    }
                    style={
                      focusedField === "pwd-confirm"
                        ? { ...inputFocusStyle, paddingRight: 40 }
                        : { ...inputStyle, paddingRight: 40 }
                    }
                    onFocus={() => setFocusedField("pwd-confirm")}
                    placeholder="Ulang kata laluan baharu"
                    aria-label="Sahkan kata laluan baharu"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd((p) => !p)}
                    title="Tunjuk/sembunyi pengesahan kata laluan"
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                    aria-label={showConfirmPwd ? "Sembunyikan pengesahan kata laluan" : "Tunjukkan pengesahan kata laluan"}
                  >
                    {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Match indicator */}
                {pwd.confirm && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color:
                        pwd.newPwd === pwd.confirm ? "#16a34a" : "#ef4444",
                    }}
                  >
                    {pwd.newPwd === pwd.confirm ? (
                      <>
                        <Check size={12} />
                        Kata laluan sepadan
                      </>
                    ) : (
                      "Kata laluan tidak sepadan"
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={toggleChangingPassword}
                  title="Batal tukar kata laluan"
                  aria-label="Batal tukar kata laluan"
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #dddfe2",
                    background: "#fff",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#bec3c9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  title="Sahkan tukar kata laluan"
                  aria-label="Sahkan tukar kata laluan"
                  disabled={changePasswordMutation.isPending}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: changePasswordMutation.isPending
                      ? "not-allowed"
                      : "pointer",
                    opacity: changePasswordMutation.isPending ? 0.7 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {changePasswordMutation.isPending ? (
                    <RefreshCw
                      size={14}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    <KeyRound size={14} />
                  )}
                  {changePasswordMutation.isPending
                    ? "Menukar..."
                    : "Tukar Kata Laluan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Inline spin keyframes                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Sub-component: FieldDisplay (read mode)
// ============================================================================

function FieldDisplay({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(0, 0, 0, 0.02)",
        border: "1px solid rgba(0, 0, 0, 0.04)",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "var(--text-primary)",
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
    </div>
  );
}