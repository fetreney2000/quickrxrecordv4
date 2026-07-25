/**
 * StockDetailPage — Placeholder.
 * Versi penuh dengan 4 FoldableCards akan ditambah dalam fasa akan datang.
 */
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Pill } from "lucide-react";

export default function StockDetailPage() {
  useEffect(() => {
    document.title = "Butiran Item — QuickRxRecord";
  }, []);

  return (
    <PlaceholderPage
      title="Butiran Item"
      subtitle="Urus maklumat item, kelompok, pesakit, dan sejarah transaksi"
      icon={Pill}
      phase={8}
    />
  );
}
