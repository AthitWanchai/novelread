"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return <CheckboxPrimitive.Root data-slot="checkbox" className={cn("ui-checkbox", className)} {...props}><CheckboxPrimitive.Indicator className="ui-checkbox-indicator"><Check aria-hidden="true" /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
}
