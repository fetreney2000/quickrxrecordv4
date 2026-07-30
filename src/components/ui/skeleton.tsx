export function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`shimmer rounded-lg ${className ?? ""}`}
      style={{ ...style }}
      {...props}
    />
  );
}

export function SkeletonRow({ cols = 5, height = 60 }: { cols?: number; height?: number }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 rounded" style={{ flex: i === 0 ? 2 : i === cols - 1 ? 0.8 : 1, width: "100%" }} />
      ))}
    </div>
  );
}
