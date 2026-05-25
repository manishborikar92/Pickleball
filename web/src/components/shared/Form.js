"use client";

import { useId } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard Form input styling classes.
 */
const inputBase =
  "w-full rounded-lg border border-line bg-background px-4 py-3 text-base text-foreground transition-all placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/**
 * Labeled form layout container.
 * Wraps inputs, labels, descriptions, and validations.
 */
export function FormField({
  label,
  description,
  error,
  required = false,
  className = "",
  children,
}) {
  const generatedId = useId();
  const child = typeof children === "function" ? children(generatedId) : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && (
        <label className="text-sm font-bold text-muted flex items-center justify-between">
          <span>
            {label}
            {required && <span className="ml-1 text-accent">*</span>}
          </span>
          {description && (
            <span className="text-[10px] font-medium tracking-normal text-muted/60 normal-case sm:text-xs">
              {description}
            </span>
          )}
        </label>
      )}
      {child}
      {error && (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Custom Input Component.
 * Supports prefix (like "+91") and custom suffixes.
 */
export function Input({
  className = "",
  error = false,
  prefix,
  suffix,
  icon: Icon,
  ...props
}) {
  if (prefix || Icon || suffix) {
    return (
      <div 
        className={cn(
          "flex items-stretch overflow-hidden rounded-xl border bg-background shadow-inner transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent border-line",
          error ? "border-danger" : "border-line",
          className
        )}
      >
        {prefix && (
          <span className="flex items-center border-r border-line bg-surface-panel/50 px-4 text-sm font-bold text-muted select-none">
            {prefix}
          </span>
        )}
        {Icon && (
          <div className="flex items-center pl-3.5 select-none">
            <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
          </div>
        )}
        <input
          className={cn(
            "min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-foreground transition-colors focus:outline-none disabled:cursor-not-allowed md:text-sm",
            Icon && "pl-2.5"
          )}
          {...props}
        />
        {suffix && (
          <span className="flex items-center border-l border-line bg-surface-panel/50 px-4 text-sm font-bold text-muted select-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      className={cn(
        inputBase,
        error && "border-danger focus:border-danger focus:ring-danger",
        className
      )}
      {...props}
    />
  );
}

/**
 * Custom Select Component.
 */
export function Select({ className = "", error = false, children, ...props }) {
  return (
    <select
      className={cn(
        inputBase,
        error && "border-danger focus:border-danger focus:ring-danger",
        "cursor-pointer appearance-none",
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23c5c9ac' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
        backgroundPosition: "right 0.75rem center",
        backgroundSize: "1.25rem",
        backgroundRepeat: "no-repeat",
        paddingRight: "2.5rem",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * Custom Textarea Component.
 */
export function Textarea({ className = "", error = false, ...props }) {
  return (
    <textarea
      className={cn(
        inputBase,
        "resize-y",
        error && "border-danger focus:border-danger focus:ring-danger",
        className
      )}
      {...props}
    />
  );
}

/**
 * Standard Alert banner component.
 */
export function FormAlert({ type = "error", message, className = "" }) {
  if (!message) return null;

  const isError = type === "error";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3 text-sm transition-all",
        isError
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-green-500/30 bg-green-500/10 text-green-500",
        className
      )}
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <p className="font-medium">{message}</p>
    </div>
  );
}
