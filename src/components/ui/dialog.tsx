"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import { cn } from "@/lib/utils";

type DialogPresence = { open: boolean };
const DialogPresenceContext = React.createContext<DialogPresence>({
  open: false,
});

const Dialog = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const [uncontrolled, setUncontrolled] = React.useState(!!defaultOpen);
  const open = openProp ?? uncontrolled;

  return (
    <DialogPresenceContext.Provider value={{ open }}>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (openProp === undefined) setUncontrolled(next);
          onOpenChange?.(next);
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogPresenceContext.Provider>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "absolute inset-0 bg-black/45 backdrop-blur-md",
      "motion-reduce:backdrop-blur-none contrast-more:bg-black/70 contrast-more:backdrop-blur-none",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { open } = React.useContext(DialogPresenceContext);
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;

  return (
    <DialogPortal forceMount>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="dialog-layer"
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <DialogOverlay />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <motion.div
                className="pointer-events-auto w-full max-w-lg"
                initial={
                  reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, transform: "scale(0.96)" }
                }
                animate={
                  reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, transform: "scale(1)" }
                }
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, transform: "scale(0.96)" }
                }
                transition={transition}
              >
                <DialogPrimitive.Content
                  ref={ref}
                  className={cn(
                    "relative grid w-full gap-4 rounded-2xl border border-white/50 bg-card p-6 shadow-[var(--shadow-elevated)] material-sheet",
                    "contrast-more:border-foreground contrast-more:bg-background",
                    className,
                  )}
                  {...props}
                >
                  {children}
                  <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1 opacity-70 ring-offset-background transition-[transform,opacity,background-color] duration-100 ease-out hover:opacity-100 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none active:scale-95">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </DialogPrimitive.Content>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
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
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-xl font-bold leading-tight tracking-tight text-foreground",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
