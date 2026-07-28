/**
 * FoldableCard — Card dengan keupayaan buka/tutup.
 *
 * - Klik pengepala untuk membuka/menutup
 * - Ikon ChevronDown berputar 180° semasa dibuka
 */
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FoldableCardProps {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function FoldableCard({
  title,
  defaultOpen = true,
  children,
  headerExtra,
  className,
  contentClassName,
}: FoldableCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={className}>
      <div
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex items-center justify-between gap-3 px-5 py-3 cursor-pointer select-none hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2
            className="text-base font-bold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
        </div>
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {headerExtra}
          <div style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <ChevronDown
              className="w-4 h-4"
              style={{ color: "var(--text-secondary)" }}
            />
          </div>
        </div>
      </div>
      {open && (
        <div>
          <CardContent
            className={cn("pt-0 border-t border-[#f0f2f5]", contentClassName)}
          >
            {children}
          </CardContent>
        </div>
      )}
    </Card>
  );
}