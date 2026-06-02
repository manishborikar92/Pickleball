import { Card } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";

export function PricingManager() {
  return (
    <ManagerSurface
      title="Pricing Manager"
      description="Rules are modeled as isolated records ready for backend JSONB pricing evaluation."
    >
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <p className="text-sm font-medium text-muted">No pricing rules are available from the current backend APIs.</p>
        </Card>
        <SimpleRows rows={[]} />
      </div>
    </ManagerSurface>
  );
}
