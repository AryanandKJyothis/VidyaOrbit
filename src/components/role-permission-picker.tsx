import { Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INVITE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type InviteRole,
} from "@/lib/workspace-roles";

const PRESET_ICONS: Record<InviteRole, typeof Shield> = {
  manager: Shield,
  staff: Sparkles,
};

/**
 * Manager vs Staff picker used by Invite and Edit dialogs.
 * Permissions are derived from the role on the server — this UI does not
 * offer Viewer or a custom matrix.
 */
export function RolePermissionPicker({
  value,
  onChange,
  allowedRoles = [...INVITE_ROLES],
}: {
  value: InviteRole;
  onChange: (next: InviteRole) => void;
  allowedRoles?: readonly InviteRole[];
}) {
  return (
    <div role="radiogroup" aria-label="Role" className="grid gap-2">
      {allowedRoles.map((key) => {
        const active = value === key;
        const Icon = PRESET_ICONS[key];
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={cn(
              "flex min-h-11 items-start gap-3 rounded-lg border p-3 text-left transition-[border-color,background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)]",
              "active:scale-[0.99] motion-reduce:active:scale-100",
              active
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40",
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
                {ROLE_LABELS[key]}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[key]}
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
