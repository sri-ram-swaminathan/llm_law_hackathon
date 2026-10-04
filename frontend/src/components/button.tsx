import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:brightness-110 active:brightness-95 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]",
        secondary: "border bg-surface text-text hover:bg-surface-2",
        ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
      },
      size: { sm: "h-8 px-3", md: "h-9 px-4", icon: "h-8 w-8" },
    },
    defaultVariants: { variant: "secondary", size: "sm" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...p }, ref) => {
  const C = asChild ? Slot : "button";
  return <C ref={ref} className={cn(button({ variant, size }), className)} {...p} />;
});
Button.displayName = "Button";
