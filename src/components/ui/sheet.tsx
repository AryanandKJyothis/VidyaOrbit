"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import { cn } from "@/lib/utils";

type SheetPresence = { open: boolean };
const SheetPresenceContext = React.createContext<SheetPresence>({
  open: false,
});

const Sheet = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) => {
  const [uncontrolled, setUncontrolled] = React.useState(!!defaultOpen);
  const open = openProp ?? uncontrolled;

  return (
    <SheetPresenceContext.Provider value={{ open }}>
      <SheetPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (openProp === undefined) setUncontrolled(next);
          onOpenChange?.(next);
        }}
        {...props}
      >
        {children}
      </SheetPrimitive.Root>
    </SheetPresenceContext.Provider>
  );
};

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "absolute inset-0 bg-black/45 backdrop-blur-sm",
      "motion-reduce:backdrop-blur-none contrast-more:bg-black/70 contrast-more:backdrop-blur-none",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva("flex h-full w-full flex-col gap-4 p-6", {
  variants: {
    side: {
      top: "",
      bottom: "",
      left: "",
      right: "",
    },
  },
  defaultVariants: {
    side: "right",
  },
});

const sheetFrame = {
  top: "inset-x-0 top-0 border-b",
  bottom: "inset-x-0 bottom-0 border-t",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
  right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
} as const;

/** Full transform strings stay hardware-accelerated under load (animate skill). */
const sheetMotion = {
  top: {
    hidden: { transform: "translateY(-100%)" },
    visible: { transform: "translateY(0%)" },
  },
  bottom: {
    hidden: { transform: "translateY(100%)" },
    visible: { transform: "translateY(0%)" },
  },
  left: {
    hidden: { transform: "translateX(-100%)" },
    visible: { transform: "translateX(0%)" },
  },
  right: {
    hidden: { transform: "translateX(100%)" },
    visible: { transform: "translateX(0%)" },
  },
} as const;

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
  const { open } = React.useContext(SheetPresenceContext);
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;
  const edge = side ?? "right";
  const axis = sheetMotion[edge];

  return (
    <SheetPortal forceMount>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="sheet-overlay"
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <SheetOverlay />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="sheet-panel"
            className={cn(
              "fixed z-50 overflow-y-auto bg-background shadow-[var(--shadow-elevated)] material-sheet",
              sheetFrame[edge],
              className,
            )}
            initial={reducedMotion ? { opacity: 0 } : axis.hidden}
            animate={reducedMotion ? { opacity: 1 } : axis.visible}
            exit={reducedMotion ? { opacity: 0 } : axis.hidden}
            transition={transition}
          >
            <SheetPrimitive.Content
              ref={ref}
              className={cn(sheetVariants({ side }), className)}
              {...props}
            >
              <SheetPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1 opacity-70 ring-offset-background transition-[transform,opacity] duration-100 ease-out hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none active:scale-95">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </SheetPrimitive.Close>
              {children}
            </SheetPrimitive.Content>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
