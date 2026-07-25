import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ArrowLeft, type LucideIcon } from "lucide-react";
import { useNavStore } from "@/lib/nav-store";
import type { BreadcrumbItem } from "@/types";
import { cn } from "@/lib/utils";

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  icon?: LucideIcon;
  showBackButton?: boolean;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function Breadcrumb({
  items,
  icon: Icon,
  showBackButton = true,
  backHref,
  backLabel,
  className,
}: BreadcrumbProps) {
  const navigate = useNavigate();
  const source = useNavStore((s) => s.source);
  const customTrail = useNavStore((s) => s.customTrail);
  const setNavSource = useNavStore((s) => s.setNavSource);

  // Determine the back link
  const getBackHref = () => {
    if (backHref) return backHref;
    if (source === "search") return "/pesakit";
    if (source === "list") return "/pesakit";
    return null;
  };

  const getBackLabel = () => {
    if (backLabel) return backLabel;
    if (source === "search") return "Kembali ke Carian";
    if (source === "list") return "Kembali ke Senarai";
    return "Kembali";
  };

  const backHrefResolved = getBackHref();
  const handleBack = () => {
    if (backHrefResolved) {
      setNavSource("default");
      navigate(backHrefResolved);
    }
  };

  const trail = items ?? customTrail ?? [];

  return (
    <nav
      className={cn(
        "flex items-center gap-2 text-sm flex-wrap",
        className
      )}
    >
      {showBackButton && backHrefResolved && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[13px] font-medium">{getBackLabel()}</span>
        </button>
      )}

      {showBackButton && backHrefResolved && trail.length > 0 && (
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
      )}

      {trail.map((item, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={i} className="flex items-center gap-2 min-w-0">
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate font-medium",
                  isLast ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            )}
          </span>
        );
      })}

      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground ml-1" />}
    </nav>
  );
}
