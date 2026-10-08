"use client";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
export const DropdownMenu = Dropdown.Root;
export const DropdownMenuTrigger = Dropdown.Trigger;
export const DropdownMenuItem = Dropdown.Item;
export function DropdownMenuContent(props: ComponentProps<typeof Dropdown.Content>) { return <Dropdown.Portal><Dropdown.Content sideOffset={8} className="dropdown-content" {...props} /></Dropdown.Portal>; }
