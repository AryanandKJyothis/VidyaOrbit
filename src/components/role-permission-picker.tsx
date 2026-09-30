import { useEffect, useState } from "react";
import { Shield, Sparkles, Eye, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionChecklist } from "@/components/permission-checklist";
import {
  PERMISSION_PRESETS,
  detectPresetOrCustom,
  type Permissions,
  type WorkspaceRole,
} from "@/lib/workspace.functions";

type PresetKey = Exclude<WorkspaceRole, "owner"> | "custom";

const PRESETS: {
  key: PresetKey;
  label: string;
  description: string;
  icon: typeof Shield;
}[] = [
  {
    key: "manager",
    label: "Manager",
    description: "Runs the institute — full access except billing.",
    icon: Shield,
  },
  {
    key: "staff",
    label: "Staff",
    description: "Day-to-day work — students, attendance, fees.",
    icon: Sparkles,
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access to everything.",
    icon: Eye,
  },
  {
    key: "custom",
    label: "Custom",
    description: "Pick exactly what they can see or change.",
    icon: Sliders,
  },
];

type Value = {
  role: Exclude<WorkspaceRole, "owner">;
  permissions: Permissions;
};

/**
 * Shared role + permissions picker used by both the Invite and Edit dialogs.
 * Presets-first: the long permission checklist only appears when "Custom" is selected
 * or when the value already diverges from any preset (so editing a custom member
 * doesn't silently hide what they have).
 */
export function RolePermissionPicker({
  value,
  onChange,
}: {
  value: Value;
  onChange: (next: Value) => void;
}) {
  // The visible preset is derived from permissions, not from role alone — that way
  // the UI never silently lies if the saved role + permissions disagree.
  const detected = detectPresetOrCustom(value.permissions);
  const [selected, setSelected] = useState<PresetKey>(detected);

  // Keep the selected pill in sync when the parent swaps the value (e.g., editing
  // a different member).
  useEffect(() => {
    setSelected(detectPresetOrCustom(value.permissions));
  }, [value.permissions]);

  function pick(next: PresetKey) {
    setSelected(next);
    if (next === "custom") {
      // Keep current permissions, but normalize the role so the server accepts it.
      onChange({ role: value.role ?? "staff", permissions: value.permissions });
    } else {
      onChange({ role: next, permissions: PERMISSION_PRESETS[next] });
    }
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Role" className="grid gap-2">
        {PRESETS.map((p) => {
          const active = selected === p.key;
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(p.key)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight">
                  {p.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {p.description}
                </div>
              </div>
              <div
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                  active
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30",
                )}
              />
            </button>
          );
        })}
      </div>

      {(selected === "custom" || detected === "custom") && (
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Shield className="h-3 w-3" /> Permissions
          </div>
          <PermissionChecklist
            value={value.permissions}
            onChange={(p) => onChange({ role: value.role, permissions: p })}
          />
        </div>
      )}
    </div>
  );
}

export function EmailField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="invite-email">Email address</Label>
      <Input
        id="invite-email"
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="teammate@institute.in"
        autoComplete="email"
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        They&apos;ll need to sign in with this exact email to accept.
      </p>
    </div>
  );
}
