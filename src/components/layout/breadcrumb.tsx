import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const trail: BreadcrumbItem[] = [{ label: "Utama", href: "/" }, ...(items ?? [])];

  return (
    <nav className={`flex items-center gap-1.5 text-sm flex-wrap ${className ?? ""}`}>
      {trail.map((item, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9ca3af" }} />
            )}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {i === 0 ? <Home className="w-3.5 h-3.5" /> : null}
                <span className="truncate">{item.label}</span>
              </Link>
            ) : (
              <span
                className="flex items-center gap-1 truncate font-medium"
                style={{ color: isLast ? "#1c1e21" : "#65676b" }}
              >
                {i === 0 ? <Home className="w-3.5 h-3.5" /> : null}
                <span className="truncate">{item.label}</span>
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}