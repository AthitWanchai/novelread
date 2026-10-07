"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const normalized = Math.max(0, Math.min(100, value ?? 0));
  return <ProgressPrimitive.Root data-slot="progress" className={cn("ui-progress", className)} value={normalized} {...props}><ProgressPrimitive.Indicator className="ui-progress-indicator" style={{ transform: `translateX(-${100 - normalized}%)` }} /></ProgressPrimitive.Root>;
}
