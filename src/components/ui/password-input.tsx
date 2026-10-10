import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle — Checklist Design login/sign-up
 * item: owners often type on a phone after class.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-[transform,color,background-color] duration-150 [transition-timing-function:var(--ease-out)] hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:active:scale-100"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
