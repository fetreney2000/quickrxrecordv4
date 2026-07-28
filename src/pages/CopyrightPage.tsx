/**
 * CopyrightPage — Halaman "About" statik.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Phone, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Shield } from "lucide-react";

export default function CopyrightPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    document.title = "Hak Cipta — QuickRxRecord";
  }, []);

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Hak Cipta" }]} />

      {/* Background orb */}
      <div
        className="fixed pointer-events-none -z-10"
        style={{
          width: 300,
          height: 300,
          top: -60,
          right: -60,
          background: "rgba(228,29,72,0.04)",
          borderRadius: "50%",
          filter: "blur(30px)",
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-red-50"
          style={{ color: "#e11d48" }}
          aria-label="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1
            className="text-[22px] font-bold leading-tight"
            style={{ color: "#1c1e21", letterSpacing: "-0.01em" }}
          >
            Hak Cipta
          </h1>
          <p
            className="text-[13px] font-medium mt-0.5"
            style={{ color: "#65676b" }}
          >
            Maklumat pembangun dan notis hak cipta
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div>
        <Card>
          <CardContent className="p-0 relative">
            {/* Gradient border */}
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                padding: 1.5,
                background:
                  "linear-gradient(135deg, rgba(228,29,72,0.4), rgba(24,119,242,0.3), rgba(124,58,237,0.3))",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />

            {/* Accent bar */}
            <div
              className="absolute top-0 left-6 right-6 h-[3px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #e11d48, #1877f2, #7c3aed, #e11d48)",
              }}
            />

            <div className="p-6 sm:p-8 space-y-6">
              {/* Profile Header */}
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #1877f2, #0d5bd4)",
                    boxShadow: "0 6px 20px rgba(24,119,242,0.3)",
                  }}
                >
                  <User className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <h2
                  className="text-[18px] font-bold"
                  style={{ color: "#1c1e21" }}
                >
                  QuickRxRecord v4.0
                </h2>
                <p
                  className="text-[13px] font-medium mt-0.5"
                  style={{ color: "#65676b" }}
                >
                  Sistem Pengurusan Inventori dan Pesakit
                </p>
              </div>

              {/* Developer Info */}
              <div
                className="rounded-xl p-4 space-y-3"
                style={{ background: "rgba(24,119,242,0.03)" }}
              >
                <InfoRow
                  icon={<User className="w-3.5 h-3.5" />}
                  iconColor="#1877f2"
                  label="Nama"
                  value="Ahmad Fetre Bin Mohammad Zime"
                />
                <InfoRow
                  icon={<Phone className="w-3.5 h-3.5" />}
                  iconColor="#22c55e"
                  label="No. Telefon"
                  value="016-881 3920"
                />
                <InfoRow
                  icon={<Mail className="w-3.5 h-3.5" />}
                  iconColor="#22c55e"
                  label="Email"
                  value="fetreney2000@gmail.com"
                />
              </div>

              {/* Copyright Notice */}
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: "rgba(240,242,245,0.5)" }}
              >
                <p
                  className="text-xs"
                  style={{ color: "#9ca3af" }}
                >
                  © {currentYear} QuickRxRecord · Jabatan Farmasi Hospital
                  Keningau. Hak cipta terpelihara.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string;
}

function InfoRow({ icon, iconColor, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `${iconColor}15`,
          color: iconColor,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "#9ca3af" }}
        >
          {label}
        </p>
        <p
          className="text-[13px] font-semibold truncate"
          style={{ color: "#1c1e21" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}