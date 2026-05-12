export function Card({ children, className = "" }) {
  return (
    <section className={`rounded-lg border border-line bg-surface-panel ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({ eyebrow, title, children, align = "center" }) {
  return (
    <div className={align === "left" ? "text-left" : "mx-auto max-w-2xl text-center"}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-black text-foreground sm:text-3xl">{title}</h2>
      {children ? <p className="mt-3 text-base leading-7 text-muted">{children}</p> : null}
    </div>
  );
}
