import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MARKETING_OPT_IN_LABEL } from "@/lib/marketing-opt-in";
import { cn } from "@/lib/utils";

export function MarketingOptInCheckbox({
  checked,
  onCheckedChange,
  id = "marketing-opt-in",
  disabled = false,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-describedby={`${id}-hint`}
      />
      <div className="min-w-0">
        <Label
          htmlFor={id}
          className="text-sm font-normal leading-snug text-foreground"
        >
          {MARKETING_OPT_IN_LABEL}
        </Label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted-foreground">
          Optional. Leave unchecked if you only want account emails.
        </p>
      </div>
    </div>
  );
}
