"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipInstantContext = React.createContext<{
  skipDelay: boolean;
  markOpen: () => void;
  markClosed: () => void;
}>({
  skipDelay: false,
  markOpen: () => {},
  markClosed: () => {},
});

/**
 * Tooltip provider with Emil-style skip-delay: after the first tooltip
 * opens, neighbours appear instantly (no delay, no entrance animation).
 */
function TooltipProvider({
  children,
  delayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  const [skipDelay, setSkipDelay] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const markOpen = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setSkipDelay(true);
  }, []);

  const markClosed = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setSkipDelay(false), 280);
  }, []);

  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <TooltipInstantContext.Provider value={{ skipDelay, markOpen, markClosed }}>
      <TooltipPrimitive.Provider
        delayDuration={skipDelay ? 0 : delayDuration}
        {...props}
      >
        {children}
      </TooltipPrimitive.Provider>
    </TooltipInstantContext.Provider>
  );
}

function Tooltip({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const { markOpen, markClosed } = React.useContext(TooltipInstantContext);
  return (
    <TooltipPrimitive.Root
      {...props}
      onOpenChange={(open) => {
        if (open) markOpen();
        else markClosed();
        onOpenChange?.(open);
      }}
    />
  );
}

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  const { skipDelay } = React.useContext(TooltipInstantContext);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground origin-(--radix-tooltip-content-transform-origin)",
          skipDelay
            ? "animate-none"
            : "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
