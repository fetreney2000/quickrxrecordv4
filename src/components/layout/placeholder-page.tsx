import { Construction, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import type { BreadcrumbItem } from "@/types";

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  phase: number;
  icon: LucideIcon;
  breadcrumb?: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
}

export function PlaceholderPage({
  title,
  subtitle,
  phase,
  icon: Icon,
  breadcrumb,
  backHref,
  backLabel,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <Breadcrumb
        items={breadcrumb ?? [{ label: title }]}
        backHref={backHref}
        backLabel={backLabel}
      />
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{
              background: "linear-gradient(135deg, #1877f2, #0d5bd4)",
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[13px] font-medium text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(24,119,242,0.1)", color: "#1877f2" }}
          >
            <Construction className="w-8 h-8" />
          </div>
          <h2 className="text-base font-semibold mb-1">Akan Datang</h2>
          <p className="text-sm text-muted-foreground">
            Halaman ini akan dibina pada Fasa {phase}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
