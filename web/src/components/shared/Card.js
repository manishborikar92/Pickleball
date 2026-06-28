import { cn } from "@/lib/utils";

export function Card({ children, className = "", as: Component = "section" }) {
  return (
    <Component className={cn("overflow-hidden rounded-xl border border-line bg-surface-panel shadow-sm", className)}>
      {children}
    </Component>
  );
}
