export function Badge({ children, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "border-line bg-surface-high text-muted",
    accent: "border-accent/40 bg-accent text-black",
    danger: "border-danger/40 bg-danger/15 text-danger",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
