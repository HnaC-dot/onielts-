import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60",
        secondary:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        amber:
          "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60",
        outline:
          "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
