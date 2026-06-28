import { Card } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";

export function PricingManager() {
  return (
    <ManagerSurface
      title="Pricing Manager"
      description="Rules are modeled as isolated records ready for backend JSONB pricing evaluation."
    >
      <div className="space-y-4 md:space-y-0 md:h-full md:min-h-0 md:overflow-hidden flex flex-col md:gap-4">
        <Card className="p-4 sm:p-5 shrink-0">
          <p className="text-sm font-medium text-muted">No pricing rules are available from the current backend APIs.</p>
        </Card>
        <SimpleRows rows={[]} className="md:flex-1 md:min-h-0" />
      </div>
    </ManagerSurface>
  );
}
