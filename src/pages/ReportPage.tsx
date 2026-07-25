/**
 * ReportPage — Placeholder.
 * Versi penuh dengan 2 tab (Inventori / Transaksi) dan eksport Excel/PDF
 * akan ditambah dalam fasa akan datang.
 */
import { useEffect } from "react";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { BarChart3 } from "lucide-react";

export default function ReportPage() {
  useEffect(() => {
    document.title = "Laporan — QuickRxRecord";
  }, []);

  return (
    <PlaceholderPage
      title="Laporan"
      subtitle="Laporan inventori dan transaksi bekalan dengan eksport Excel/PDF"
      icon={BarChart3}
      phase={9}
    />
  );
}
