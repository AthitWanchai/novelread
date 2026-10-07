import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function Input({ className, type = "text", ...props }, ref) {
  return <input ref={ref} type={type} data-slot="input" className={cn("ui-input", className)} {...props} />;
});
