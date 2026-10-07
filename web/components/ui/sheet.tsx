"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

export function SheetOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay data-slot="sheet-overlay" className={cn("ui-sheet-overlay", className)} {...props} />;
}

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "top" | "right" | "bottom" | "left"; showClose?: boolean };
export function SheetContent({ className, children, side = "right", showClose = true, ...props }: SheetContentProps) {
  return <SheetPortal><SheetOverlay /><DialogPrimitive.Content data-slot="sheet-content" data-side={side} className={cn("ui-sheet-content", className)} {...props}>
    {children}
    {showClose && <DialogPrimitive.Close data-slot="sheet-close" className="ui-sheet-close"><X aria-hidden="true" /><span className="sr-only">ปิดเมนู</span></DialogPrimitive.Close>}
  </DialogPrimitive.Content></SheetPortal>;
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-header" className={cn("ui-sheet-header", className)} {...props} />; }
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title data-slot="sheet-title" className={cn("ui-sheet-title", className)} {...props} />; }
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description data-slot="sheet-description" className={cn("ui-sheet-description", className)} {...props} />; }
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-footer" className={cn("ui-sheet-footer", className)} {...props} />; }
