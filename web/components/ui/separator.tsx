"use client";

import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal", decorative = true, ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root data-slot="separator" decorative={decorative} orientation={orientation} className={cn("ui-separator", orientation === "horizontal" ? "ui-separator-horizontal" : "ui-separator-vertical", className)} {...props} />;
}
