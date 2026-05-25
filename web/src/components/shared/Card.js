import { cn } from "@/lib/utils";

export function Card({ children, className = "", as: Component = "section" }) {
  return (
    <Component className={cn("overflow-hidden rounded-xl border border-line bg-surface-panel shadow-sm", className)}>
      {children}
    </Component>
  );
}

export function SectionHeader({ eyebrow, title, children, align = "center" }) {
  const isLeft = align === "left";
  
  return (
    <div className={cn("flex flex-col", isLeft ? "text-left" : "mx-auto max-w-2xl items-center text-center")}>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent sm:mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-balance text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {children && (
        <p className={cn("mt-3 text-sm leading-relaxed text-muted sm:mt-4 sm:text-base", isLeft ? "max-w-3xl" : "max-w-2xl")}>
          {children}
        </p>
      )}
    </div>
  );
}