import type { Permissions } from "@/lib/workspace.functions";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RESOURCES: { key: keyof Permissions; label: string; hint?: string }[] = [
  { key: "students", label: "Students" },
  { key: "batches", label: "Batches" },
  { key: "attendance", label: "Attendance" },
  { key: "fees", label: "Fees & receipts" },
  { key: "settings", label: "Institute settings" },
  { key: "billing", label: "Billing & subscription", hint: "Only the owner should usually have this." },
];

export function PermissionChecklist({
  value,
  onChange,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
}) {
  return (
    <div className="space-y-3">
      {RESOURCES.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium">{r.label}</Label>
            {r.hint && <p className="text-xs text-muted-foreground">{r.hint}</p>}
          </div>
          <Select
            value={value[r.key]}
            onValueChange={(v) => onChange({ ...value, [r.key]: v as "none" | "read" | "write" })}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No access</SelectItem>
              <SelectItem value="read">View only</SelectItem>
              <SelectItem value="write">Full access</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
