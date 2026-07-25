import { useNavigate } from "react-router-dom";
import { LogOut, Mail, Briefcase, User as UserIcon, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { getInitials, formatDate, toTitleCase } from "@/lib/utils";

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (!profile) return null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Breadcrumb
        showBackButton={false}
        items={[{ label: "Profil" }]}
        icon={UserIcon}
      />

      <div className="page-header">
        <h1 className="text-[22px] font-bold text-foreground">Profil Saya</h1>
        <p className="text-[13px] font-medium text-muted-foreground mt-0.5">
          Maklumat akaun dan pilihan log keluar
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
                boxShadow: "0 4px 12px rgba(24,119,242,0.4)",
              }}
            >
              {getInitials(profile.nama)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">
                {toTitleCase(profile.nama)}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                @{profile.nama_pengguna}
              </p>
              <Badge variant="blue" className="mt-1.5">
                {profile.peranan}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
              <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-2xs text-muted-foreground">Jawatan</p>
                <p className="text-sm font-medium">{profile.jawatan}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-2xs text-muted-foreground">Nama Pengguna</p>
                <p className="text-sm font-medium">{profile.nama_pengguna}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-2xs text-muted-foreground">Ahli Sejak</p>
                <p className="text-sm font-medium">
                  {formatDate(profile.created_at)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tindakan</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Log Keluar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
