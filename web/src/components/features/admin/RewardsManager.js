"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, Gift, Loader2, Plus, Search, Ticket, Trash2 } from "lucide-react";

import { Badge, Button, Card, EmptyState, FormAlert, FormField, Input, Select, Textarea } from "@/components/shared";
import { DataTable, StatusBadge } from "@/components/shared/Table";
import { useTable } from "@/hooks/useTable";
import { rewardMechanismSchema } from "@/lib/schemas";
import {
  createRewardMechanismAction,
  expireRewardInstanceAction,
  lookupVoucherAction,
  redeemVoucherAction,
  setRewardMechanismActiveAction,
  updateRewardMechanismAction,
} from "@/lib/actions/rewardsAdmin";
import { formatRewardDateShort } from "@/lib/rewardDates";
import { ManagerSurface } from "./ManagerSurface";

/**
 * /admin/rewards — end-to-end reward operations:
 *   1. Redemption desk: staff look up a voucher code and mark it redeemed
 *      (manage_bookings; first redemption wins, backend-guarded).
 *   2. Mechanisms: create/edit scratch-card prize pools, expiry, and active
 *      state (edit_pricing; hidden for staff, backend re-enforces).
 *   3. Instances: the venue's recent reward instances with expire/redeem.
 *
 * All mutations run through route-independent server actions; after a success
 * the route is refreshed so the server-fetched lists stay authoritative.
 *
 * @param {Object} props
 * @param {string} props.venueId
 * @param {object[]} props.mechanisms - Normalized mechanisms (empty for staff).
 * @param {object[]} props.instances - Normalized moderation instances.
 * @param {boolean} props.canEditPricing - Frontend gate for the mechanisms panel.
 */
export function RewardsManager({ venueId, mechanisms = [], instances = [], canEditPricing = false }) {
  return (
    <ManagerSurface
      title="Rewards"
      description="Redeem vouchers at the counter, configure scratch-card prize pools, and track every issued reward."
    >
      <div className="space-y-5 sm:space-y-6 md:h-full md:min-h-0 md:overflow-y-auto">
        <VoucherDesk venueId={venueId} />
        {canEditPricing && <MechanismsPanel venueId={venueId} mechanisms={mechanisms} />}
        <InstancesPanel instances={instances} />
      </div>
    </ManagerSurface>
  );
}

/* ── 1. Redemption desk ─────────────────────────── */

function VoucherDesk({ venueId }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [results, setResults] = useState(null); // null = untouched, [] = no match
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLookup(event) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await lookupVoucherAction(venueId, code);
      if (result.ok) {
        setResults(result.data);
      } else {
        setResults(null);
        setError(result.error.message);
      }
    });
  }

  return (
    <Card className="p-5 sm:p-6 shrink-0">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-accent" aria-hidden="true" />
        <h3 className="text-lg font-black tracking-tight sm:text-xl">Redemption Desk</h3>
      </div>
      <p className="mt-1 text-sm text-muted">
        Enter the code from the customer&apos;s voucher to verify and redeem it.
      </p>

      <form onSubmit={handleLookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField label="Voucher code" className="flex-1">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RWD-XXXXXXXX"
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-widest uppercase"
          />
        </FormField>
        <Button type="submit" disabled={isPending || !code.trim()} className="justify-center sm:w-auto">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          <span>Look up</span>
        </Button>
      </form>

      {error && <FormAlert type="error" message={error} className="mt-3" />}

      {results !== null && (
        <div className="mt-4 space-y-3" aria-live="polite">
          {results.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface-soft/40 p-4 text-sm font-medium text-muted">
              No voucher matches that code for this venue. Check for typos — codes never contain 0, O, 1, or I.
            </p>
          ) : (
            results.map((instance) => (
              <VoucherResultCard
                key={instance.id}
                instance={instance}
                onRedeemed={() => {
                  setResults(null);
                  setCode("");
                  router.refresh();
                }}
              />
            ))
          )}
        </div>
      )}
    </Card>
  );
}

function VoucherResultCard({ instance, onRedeemed }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [redeemed, setRedeemed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const voucher = instance.voucher;
  const isRedeemable = instance.status === "revealed" && voucher && !voucher.redeemed;
  const validityPassed = voucher?.validUntil && new Date(voucher.validUntil) <= new Date();

  function handleRedeem() {
    setError("");
    startTransition(async () => {
      const result = await redeemVoucherAction(instance.id, note);
      if (result.ok) {
        setRedeemed(true);
        // Give the counter a beat to read the confirmation before the list refresh.
        setTimeout(onRedeemed, 1600);
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-base font-black tracking-widest text-accent">{voucher?.code}</p>
          <p className="mt-1 font-bold text-foreground">{instance.outcome?.label}</p>
          {instance.outcome?.terms && (
            <p className="mt-0.5 text-xs text-muted">{instance.outcome.terms}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            {instance.user?.name || "Customer"}
            {instance.user?.phone ? ` · ${instance.user.phone}` : ""}
            {voucher?.validUntil ? ` · Valid until ${formatRewardDateShort(voucher.validUntil)}` : ""}
          </p>
        </div>
        <VoucherStateBadge instance={instance} validityPassed={validityPassed} justRedeemed={redeemed} />
      </div>

      {redeemed ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm font-bold text-green-500" role="status">
          <Check className="h-4 w-4" aria-hidden="true" />
          Redeemed — enjoy!
        </p>
      ) : isRedeemable && !validityPassed ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Optional note (e.g. redeemed at café counter)"
            className="flex-1 py-2.5"
          />
          <Button type="button" onClick={handleRedeem} disabled={isPending} className="justify-center sm:w-auto">
            {isPending ? "Redeeming…" : "Mark Redeemed"}
          </Button>
        </div>
      ) : null}

      {error && <FormAlert type="error" message={error} className="mt-3" />}
    </div>
  );
}

function VoucherStateBadge({ instance, validityPassed, justRedeemed }) {
  if (justRedeemed || instance.voucher?.redeemed) {
    return <Badge tone="neutral">Redeemed{instance.voucher?.redeemedAt ? ` ${formatRewardDateShort(instance.voucher.redeemedAt)}` : ""}</Badge>;
  }
  if (validityPassed) return <Badge tone="danger">Validity passed</Badge>;
  if (instance.status === "revealed") return <Badge tone="accent">Ready to redeem</Badge>;
  return <StatusBadge value={instance.status} />;
}

/* ── 2. Mechanisms panel (edit_pricing) ─────────── */

function MechanismsPanel({ venueId, mechanisms }) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Card className="p-5 sm:p-6 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" aria-hidden="true" />
          <h3 className="text-lg font-black tracking-tight sm:text-xl">Reward Mechanisms</h3>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowCreate((open) => !open)}
          aria-expanded={showCreate}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New Mechanism</span>
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Each active mechanism issues one reward per confirmed booking. Prize probabilities must sum to exactly 1.0.
      </p>

      {showCreate && (
        <div className="mt-4">
          <MechanismEditor
            venueId={venueId}
            onDone={() => setShowCreate(false)}
          />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {mechanisms.length === 0 && !showCreate ? (
          <EmptyState
            title="No mechanisms yet"
            description="Create one to start issuing scratch cards on confirmed bookings."
          />
        ) : (
          mechanisms.map((mechanism) => (
            <MechanismCard key={mechanism.id} mechanism={mechanism} />
          ))
        )}
      </div>
    </Card>
  );
}

function MechanismCard({ mechanism }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleToggleActive() {
    setError("");
    startTransition(async () => {
      const result = await setRewardMechanismActiveAction(mechanism.id, !mechanism.isActive);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  const prizeSummary = (mechanism.config?.prizes || [])
    .map((prize) => `${Math.round(prize.probability * 100)}% ${prize.label}`)
    .join(" · ");

  return (
    <div className="rounded-xl border border-line bg-surface-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-foreground">{mechanism.name}</p>
            <Badge tone={mechanism.isActive ? "accent" : "neutral"}>
              {mechanism.isActive ? "Active" : "Paused"}
            </Badge>
            <Badge tone="neutral" className="capitalize">{mechanism.type.replace("_", " ")}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted" title={prizeSummary}>
            {prizeSummary || "No prizes configured"} · Cards expire after {mechanism.instanceExpiryDays} day{mechanism.instanceExpiryDays === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="secondary" onClick={handleToggleActive} disabled={isPending}>
            {isPending ? "Saving…" : mechanism.isActive ? "Pause" : "Activate"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse editor" : "Edit mechanism"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            <span>Edit</span>
          </Button>
        </div>
      </div>

      {error && <FormAlert type="error" message={error} className="mx-4 mb-3" />}

      {expanded && (
        <div className="border-t border-line p-4">
          <MechanismEditor mechanism={mechanism} onDone={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
}

const EMPTY_PRIZE = { id: "", label: "", type: "no_prize", probability: "", terms: "", validity_days: "" };

/** Editor state → the shape `rewardMechanismSchema` validates. */
function toSchemaInput(form) {
  return {
    name: form.name,
    type: form.type,
    instance_expiry_days: form.instanceExpiryDays,
    is_active: form.isActive,
    prizes: form.prizes.map((prize) => ({
      id: prize.id,
      label: prize.label,
      type: prize.type,
      probability: prize.probability,
      terms: prize.type === "voucher" ? prize.terms : "",
      ...(prize.type === "voucher" && prize.validity_days !== ""
        ? { validity_days: prize.validity_days }
        : {}),
    })),
  };
}

/**
 * Shared create/edit form. Prize rows are edited inline; validation runs
 * client-side via the shared Zod schema for instant feedback, then again
 * authoritatively inside the server action.
 */
function MechanismEditor({ venueId, mechanism, onDone }) {
  const router = useRouter();
  const isEdit = Boolean(mechanism);
  const [form, setForm] = useState(() => ({
    name: mechanism?.name || "Post-Booking Scratch Card",
    // The web app only creates/edits scratch-card mechanisms.
    type: "scratch_card",
    instanceExpiryDays: mechanism?.instanceExpiryDays ?? 7,
    isActive: mechanism?.isActive ?? false,
    prizes: (mechanism?.config?.prizes || [{ ...EMPTY_PRIZE, id: "p1" }]).map((prize) => ({
      id: prize.id,
      label: prize.label || "",
      type: prize.type || "no_prize",
      probability: prize.probability ?? "",
      terms: prize.terms || "",
      validity_days: prize.validity_days ?? "",
    })),
  }));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const probabilitySum = useMemo(
    () => form.prizes.reduce((total, prize) => total + (Number(prize.probability) || 0), 0),
    [form.prizes],
  );
  const sumOk = Math.abs(probabilitySum - 1) < 1e-9;

  function setPrize(index, patch) {
    setForm((prev) => ({
      ...prev,
      prizes: prev.prizes.map((prize, i) => (i === index ? { ...prize, ...patch } : prize)),
    }));
  }

  function addPrize() {
    setForm((prev) => ({
      ...prev,
      prizes: [...prev.prizes, { ...EMPTY_PRIZE, id: `p${prev.prizes.length + 1}` }],
    }));
  }

  function removePrize(index) {
    setForm((prev) => ({ ...prev, prizes: prev.prizes.filter((_, i) => i !== index) }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const input = toSchemaInput(form);
    const parsed = rewardMechanismSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Please complete the mechanism form.");
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateRewardMechanismAction(mechanism.id, input)
        : await createRewardMechanismAction(venueId, input);
      if (result.ok) {
        onDone?.();
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-line bg-surface-soft/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Name" className="sm:col-span-2">
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            maxLength={255}
            required
          />
        </FormField>
        <FormField label="Experience">
          {/* Scratch card is the only experience the web app ships; the field
              is informational until another mechanism type gets a UI. */}
          <Input value="Scratch card" disabled readOnly aria-label="Experience: scratch card" />
        </FormField>
        <FormField label="Card expiry" description="days to reveal">
          <Input
            type="number"
            min={1}
            max={365}
            value={form.instanceExpiryDays}
            onChange={(e) => setForm((prev) => ({ ...prev, instanceExpiryDays: e.target.value }))}
            required
          />
        </FormField>
      </div>

      <fieldset>
        <legend className="flex w-full items-center justify-between text-sm font-bold text-muted">
          <span>
            Prize pool
            <span className={`ml-2 font-mono text-xs ${sumOk ? "text-green-500" : "text-danger"}`}>
              Σ {Number(probabilitySum.toFixed(6))} / 1.0
            </span>
          </span>
          <Button type="button" variant="ghost" onClick={addPrize} disabled={form.prizes.length >= 20}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add prize</span>
          </Button>
        </legend>

        <div className="mt-2 space-y-3">
          {form.prizes.map((prize, index) => (
            <PrizeRow
              key={index}
              prize={prize}
              onChange={(patch) => setPrize(index, patch)}
              onRemove={form.prizes.length > 1 ? () => removePrize(index) : null}
            />
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-bold text-muted">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
          className="h-4 w-4 accent-accent"
        />
        <span>Active — issue a reward on every confirmed booking</span>
      </label>

      {error && <FormAlert type="error" message={error} />}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={isPending} className="justify-center">
          {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Mechanism"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} className="justify-center">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PrizeRow({ prize, onChange, onRemove }) {
  const isVoucher = prize.type === "voucher";
  return (
    <div className="rounded-lg border border-line bg-surface-panel p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <FormField label="Id" className="lg:col-span-1">
          <Input
            value={prize.id}
            onChange={(e) => onChange({ id: e.target.value })}
            maxLength={50}
            required
            className="py-2.5"
          />
        </FormField>
        <FormField label="Label" className="sm:col-span-2 lg:col-span-4">
          <Input
            value={prize.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Free Iced Coffee at the Café"
            maxLength={255}
            required
            className="py-2.5"
          />
        </FormField>
        <FormField label="Type" className="lg:col-span-2">
          <Select
            value={prize.type}
            onChange={(e) => onChange({ type: e.target.value })}
            className="py-2.5"
          >
            <option value="no_prize">No prize</option>
            <option value="voucher">Voucher</option>
          </Select>
        </FormField>
        <FormField label="Probability" description="0–1" className="lg:col-span-2">
          <Input
            type="number"
            step="any"
            min={0}
            max={1}
            value={prize.probability}
            onChange={(e) => onChange({ probability: e.target.value })}
            placeholder="0.25"
            required
            className="py-2.5"
          />
        </FormField>
        {isVoucher && (
          <FormField label="Valid for" description="days" className="lg:col-span-2">
            <Input
              type="number"
              min={1}
              max={365}
              value={prize.validity_days}
              onChange={(e) => onChange({ validity_days: e.target.value })}
              placeholder="30"
              className="py-2.5"
            />
          </FormField>
        )}
        <div className="flex items-end lg:col-span-1">
          {onRemove && (
            <Button type="button" variant="ghost" onClick={onRemove} aria-label={`Remove prize ${prize.id}`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      {isVoucher && (
        <FormField label="Terms" description="shown to the customer" className="mt-3">
          <Textarea
            value={prize.terms}
            onChange={(e) => onChange({ terms: e.target.value.slice(0, 500) })}
            rows={2}
            placeholder="Show this voucher at the counter. One per visit."
          />
        </FormField>
      )}
    </div>
  );
}

/* ── 3. Instances panel (manage_bookings) ───────── */

const INSTANCE_COLUMNS = [
  {
    key: "userName",
    label: "Player",
    sortable: true,
    searchable: true,
    render: (val, row) => (
      <div className="min-w-0">
        <p className="truncate font-bold text-foreground">{val || "Customer"}</p>
        <p className="truncate text-xs text-muted">{row.userPhone}</p>
      </div>
    ),
  },
  {
    key: "prizeLabel",
    label: "Prize",
    searchable: true,
    render: (val, row) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{val}</p>
        {row.voucherCode && (
          <p className="truncate font-mono text-xs text-accent">{row.voucherCode}</p>
        )}
      </div>
    ),
  },
  {
    key: "state",
    label: "Status",
    filterable: true,
    filterOptions: ["pending", "revealed", "redeemed", "expired"],
    render: (val) => <StatusBadge value={val} />,
  },
  {
    key: "expiresAt",
    label: "Expires",
    sortable: true,
    render: (val) => <span className="text-xs text-muted">{formatRewardDateShort(val)}</span>,
  },
  {
    key: "actions",
    label: "",
    className: "text-right md:pr-4",
    render: (_, row) => <InstanceActions row={row} />,
  },
];

function InstancesPanel({ instances }) {
  const rows = useMemo(
    () => instances.map((instance) => ({
      id: instance.id,
      userName: instance.user?.name || "",
      userPhone: instance.user?.phone || "",
      prizeLabel: instance.outcome?.label || "—",
      voucherCode: instance.voucher?.code || "",
      // Redemption folds into the status column: it is the state staff care about.
      state: instance.voucher?.redeemed ? "redeemed" : instance.status,
      status: instance.status,
      redeemed: Boolean(instance.voucher?.redeemed),
      validUntil: instance.voucher?.validUntil || "",
      expiresAt: instance.expiresAt,
    })),
    [instances],
  );

  const table = useTable(rows, {
    columns: INSTANCE_COLUMNS,
    defaultSortBy: "expiresAt",
    defaultSortOrder: "desc",
    defaultPageSize: 10,
  });

  return (
    <div className="flex flex-col">
      <h3 className="mb-3 text-lg font-black tracking-tight sm:text-xl">Issued Rewards</h3>
      <DataTable
        {...table}
        columns={INSTANCE_COLUMNS}
        emptyTitle="No rewards issued yet"
        emptyDescription="Instances appear here as soon as bookings are confirmed with an active mechanism."
        searchPlaceholder="Search by player or prize…"
        mobileCardRenderer={MobileInstanceCard}
      />
    </div>
  );
}

function InstanceActions({ row }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  const canRedeem = row.status === "revealed" && row.voucherCode && !row.redeemed
    && !(row.validUntil && new Date(row.validUntil) <= new Date());
  const canExpire = row.status === "pending";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        {canRedeem && (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => run(() => redeemVoucherAction(row.id))}
            className="min-h-0 px-3 py-1.5 text-xs"
          >
            {isPending ? "…" : "Redeem"}
          </Button>
        )}
        {canExpire && (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => run(() => expireRewardInstanceAction(row.id))}
            className="min-h-0 px-3 py-1.5 text-xs"
          >
            {isPending ? "…" : "Expire"}
          </Button>
        )}
      </div>
      {error && <p className="text-right text-[10px] font-semibold text-danger" role="alert">{error}</p>}
    </div>
  );
}

function MobileInstanceCard(row) {
  return (
    <div className="flex flex-col gap-2 p-5 hover:bg-surface-high/10 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-foreground">{row.userName || "Customer"}</p>
          <p className="truncate text-xs text-muted">{row.userPhone}</p>
        </div>
        <StatusBadge value={row.state} />
      </div>
      <p className="text-sm font-medium text-foreground">{row.prizeLabel}</p>
      <div className="flex items-center justify-between text-xs text-muted">
        {row.voucherCode ? <VoucherCodeChip code={row.voucherCode} /> : <span />}
        <span>Expires {formatRewardDateShort(row.expiresAt)}</span>
      </div>
      <InstanceActions row={row} />
    </div>
  );
}

function VoucherCodeChip({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — code stays visible for manual copy.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy voucher code ${code}`}
      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-accent"
    >
      {code}
      {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
    </button>
  );
}
