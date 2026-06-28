import { SectionHeader } from "@/components/shared";

/**
 * Shared layout wrapper for all admin manager views.
 * Provides consistent title, description, and child spacing.
 */
export function ManagerSurface({ title, description, children }) {
  return (
    <div className="flex flex-col space-y-6 md:space-y-8 md:h-full md:min-h-0 md:overflow-hidden">
      <div className="px-1 sm:px-0 shrink-0">
        <SectionHeader align="left" title={title}>
          {description}
        </SectionHeader>
      </div>
      <div className="min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}