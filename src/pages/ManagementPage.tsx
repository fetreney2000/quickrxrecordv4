/**
 * ManagementPage — Placeholder.
 * Halaman pentadbiran eksklusif untuk Pentadbir sahaja.
 * Versi penuh dengan 3 tab (Pengguna / Permintaan / Rujukan) akan ditambah.
 */
import { useEffect } from "react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { UserCog } from "lucide-react";

export default function ManagementPage() {
  useEffect(() => {
    document.title = "Pengurusan — QuickRxRecord";
  }, []);

  return (
    <PlaceholderPage
      title="Pengurusan"
      subtitle="Pusat pentadbiran sistem — pengguna, permintaan reset, rujukan"
      icon={UserCog}
      phase={10}
    />
  );
}
