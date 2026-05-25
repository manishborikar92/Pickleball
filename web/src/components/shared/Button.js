import Link from "next/link";
import { cn } from "@/lib/utils";

const base =
  "inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background select-none";

const variants = {
  primary: "bg-accent text-black shadow-[0_0_30px_rgba(202,255,0,0.16)] hover:bg-accent/90 hover:shadow-[0_0_35px_rgba(202,255,0,0.2)]",
  secondary: "border border-line bg-surface-panel text-foreground hover:border-accent hover:bg-surface-high",
  ghost: "text-muted hover:bg-surface-high hover:text-foreground",
  danger: "bg-danger text-black hover:bg-danger/90",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  href,
  ...props
}) {
  const classes = cn(base, variants[variant], className);
  
  if (href) {
    const isExternal = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("maps:");
    
    if (isExternal) {
      return (
        <a className={classes} href={href} {...props}>
          {children}
        </a>
      );
    }

    return (
      <Link className={classes} href={href} {...props}>
        {children}
      </Link>
    );
  }
  
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}