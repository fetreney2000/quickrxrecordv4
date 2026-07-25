/**
 * StockListPage — Placeholder.
 * Versi penuh tersedia dengan infrastruktur siap (hooks di use-inventory.ts).
 * Halaman penuh akan ditambah dalam fasa akan datang.
 */
import { useEffect } from "react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Pill } from "lucide-react";

export default function StockListPage() {
  useEffect(() => {
    document.title = "Inventori — QuickRxRecord";
  }, []);

  return (
    <PlaceholderPage
      title="Senarai Inventori"
      subtitle="Urus item ubat dalam katalog"
      icon={Pill}
      phase={8}
    />
  );
}
