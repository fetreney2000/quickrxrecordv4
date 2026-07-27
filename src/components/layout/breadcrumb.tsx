import { Link } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useNavStore } from "@/lib/nav-store";
import type { BreadcrumbItem } from "@/types";
import { cn } from "@/lib/utils";

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  icon?: LucideIcon;
  className?: string;
}

export function Breadcrumb({
  items,
  icon: Icon,
  className,
}: BreadcrumbProps) {
  const customTrail = useNavStore((s) => s.customTrail);
  const breadcrumbTrail = useNavStore((s) => s.breadcrumbTrail);

  const trail = items ?? customTrail ?? breadcrumbTrail ?? [];

  return (
    <nav
      className={cn(
        "flex items-center gap-2 text-sm flex-wrap",
        className
      )}
    >
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