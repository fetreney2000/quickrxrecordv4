/**
 * DeleteItemDialog — Dialog pengesahan untuk memadam item inventori.
 *
 * Menjelaskan kesan tindakan secara terperinci sebelum pengesahan:
 *   - mode="deleted"      → padam kekal (item TIDAK pernah ditugaskan)
 *   - mode="deactivated"  → kelembutan (item pernah dibekalkan; aktif=false)
 */
import {
  Trash2,
  AlertTriangle,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type DeleteMode = "deleted" | "deactivated";

export function DeleteItemDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  mode,
  itemLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  mode: DeleteMode;
  itemLabel: string;
}) {
  const isHardDelete = mode === "deleted";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
              }}
            >
              {isHardDelete ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <DialogTitle>
                {isHardDelete ? "Padam Item Secara Kekal" : "Sembunyikan Item"}
              </DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {isHardDelete
                  ? "Tindakan ini tidak boleh diterbalikkan"
                  : "Item masih disimpan untuk tujuan audit"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4 space-y-3">
          <div
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
            }}
          >
            <AlertTriangle
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              style={{ color: "#dc2626" }}
            />
            <p className="text-xs" style={{ color: "#991b1b" }}>
              {isHardDelete
                ? `Item "${itemLabel}" akan dipadam secara kekal dan tidak boleh dipulihkan.`
                : `Item "${itemLabel}" telah dibekalkan/ditugaskan kepada pesakit, jadi ia tidak boleh dipadam kekal daripada pangkalan data.`}
            </p>
          </div>

          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Kesannya:
            </p>
            {isHardDelete ? (
              <ul
                className="text-xs space-y-1.5 list-disc pl-4"
                style={{ color: "var(--text-secondary)" }}
              >
                <li>Maklumat item (kod &amp; nama) dikeluarkan daripada katalog inventori.</li>
                <li>Semua kelompok stok dan rekod transaksi stok yang berkaitan turut dipadam.</li>
                <li>Rekod pelarasan dan penambahan kelompok dipadam secara lata.</li>
                <li>
                  Item ini tidak pernah ditugaskan kepada pesakit, jadi tiada sejarah
                  bekalan pesakit akan terjejas.
                </li>
              </ul>
            ) : (
              <ul
                className="text-xs space-y-1.5 list-disc pl-4"
                style={{ color: "var(--text-secondary)" }}
              >
                <li>Item disembunyikan daripada senarai &ldquo;Senarai Inventori&rdquo; yang aktif.</li>
                <li>
                  Rekod stok, kelompok, transaksi dan sejarah bekalan pesakit dikekalkan
                  sepenuhnya untuk tujuan audit.
                </li>
                <li>
                  Penyuntingan item atau penambahan stok baharu akan dilumpuhkan pada item ini.
                </li>
                <li>
                  Tiada pilihan untuk &ldquo;aktifkan semula&rdquo; dalam aplikasi — memulihkan
                  item memerlukan pengubahsuaian pangkalan data secara manual.
                </li>
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isHardDelete ? "Ya, Padam Kekal" : "Ya, Sembunyikan Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}