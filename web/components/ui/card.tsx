import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type CardProps = React.ComponentProps<"div"> & { asChild?: boolean };
export function Card({ className, asChild, ...props }: CardProps) {
  const Comp = asChild ? Slot : "div";
  return <Comp data-slot="card" className={cn("ui-card", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-header" className={cn("ui-card-header", className)} {...props} />; }
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) { return <h3 data-slot="card-title" className={cn("ui-card-title", className)} {...props} />; }
export function CardDescription({ className, ...props }: React.ComponentProps<"p">) { return <p data-slot="card-description" className={cn("ui-card-description", className)} {...props} />; }
export function CardAction({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-action" className={cn("ui-card-action", className)} {...props} />; }
export function CardContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-content" className={cn("ui-card-content", className)} {...props} />; }
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-footer" className={cn("ui-card-footer", className)} {...props} />; }
