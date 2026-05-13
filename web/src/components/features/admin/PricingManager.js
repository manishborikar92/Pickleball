"use client";

import { useState } from "react";
import { Button, Card } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";

const INITIAL_RULES = [
  { id: "r1", name: "Weekend Peak", scope: "All courts", value: "+20%", status: "active" },
  { id: "r2", name: "Early Morning", scope: "All courts", value: "-15%", status: "active" },
  { id: "r3", name: "FIRST50", scope: "Coupon", value: "-50 INR", status: "active" },
];

export function PricingManager() {
  const [rules, setRules] = useState(INITIAL_RULES);

  function handleAddFlashRule() {
    const flashRule = {
      id: `flash-${Date.now()}`,
      name: "Flash Sale",
      scope: "Court 2",
      value: "-25%",
      status: "draft",
    };
    setRules((prev) => [flashRule, ...prev]);
  }

  return (
    <ManagerSurface
      title="Pricing Manager"
      description="Rules are modeled as isolated records ready for backend JSONB pricing evaluation."
    >
      <div className="space-y-4">
        <Card className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm font-medium text-muted">Manage active pricing matrices and discounts.</p>
          <Button type="button" onClick={handleAddFlashRule} className="w-full sm:w-auto">
            + Add Flash Rule
          </Button>
        </Card>
        <SimpleRows rows={rules} />
      </div>
    </ManagerSurface>
  );
}