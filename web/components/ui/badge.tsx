import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("ui-badge", { variants: { variant: { default: "ui-badge-default", secondary: "ui-badge-secondary", outline: "ui-badge-outline", destructive: "ui-badge-destructive" } }, defaultVariants: { variant: "default" } });
type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean };
export function Badge({ className, variant, asChild, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
