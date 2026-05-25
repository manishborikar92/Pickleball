import { cn } from "@/lib/utils";

export function Badge({ children, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "border-line bg-surface-high text-muted",
    accent: "border-accent/40 bg-accent text-black",
    danger: "border-danger/40 bg-danger/15 text-danger",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold leading-5 whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}