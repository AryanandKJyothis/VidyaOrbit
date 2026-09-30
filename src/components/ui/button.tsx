import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary/85 active:scale-[0.97] hover:shadow-[0_12px_32px_-6px_oklch(0.28_0.08_260_/_0.2)] hover:-translate-y-0.5 disabled:shadow-none transition-[background-color,transform,box-shadow,filter]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/85 active:scale-[0.97] hover:shadow-[0_12px_32px_-6px_oklch(0.62_0.2_28_/_0.2)] hover:-translate-y-0.5 transition-[background-color,transform,box-shadow]",
        outline:
          "border-2 border-input bg-background shadow-sm hover:bg-primary/8 hover:border-primary/40 hover:text-primary active:scale-[0.97] transition-[background-color,border-color,transform,box-shadow]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/70 active:scale-[0.97] transition-[background-color,transform,box-shadow]",
        ghost:
          "hover:bg-brand-teal/12 hover:text-primary active:scale-[0.96] transition-[background-color,transform]",
        link: "text-primary underline-offset-4 hover:underline active:opacity-75 transition-opacity",
      },
      size: {
        default: "h-10 sm:h-11 px-4 py-2",
        sm: "h-8 sm:h-9 rounded-md px-3 text-xs sm:text-sm",
        lg: "h-12 sm:h-13 rounded-lg px-6 sm:px-8 text-sm sm:text-base",
        icon: "h-10 w-10 sm:h-11 sm:w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
