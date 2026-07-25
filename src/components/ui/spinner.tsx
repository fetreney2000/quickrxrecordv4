import * as React from "react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  const dim =
    size === "sm" ? "h-4 w-4 border-2" : size === "lg" ? "h-8 w-8 border-[3px]" : "h-6 w-6 border-2";
  return (
    <div
      role="status"
      aria-label="Memuatkan"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent text-primary",
        dim,
        className
      )}
      {...props}
    />
  );
}

/** Full-page loading spinner with backdrop. */
export function FullPageSpinner({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background">
      <div className="relative">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"
          role="status"
          aria-label="Memuatkan"
        />
      </div>
      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
