import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type SharedProps = { children: ReactNode; className?: string; tone?: "primary" | "secondary"; };
type ActionLinkProps = SharedProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & { href: string };
type ActionButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };

export function ActionLink({ children, className = "", tone = "primary", href, ...props }: ActionLinkProps) {
  return <Button asChild variant={tone === "primary" ? "default" : "secondary"} className={`action-link action-link-${tone} ${className}`.trim()}><Link href={href} {...props}>{children}</Link></Button>;
}

export function ActionButton({ children, className = "", tone = "primary", type = "button", ...props }: ActionButtonProps) {
  return <Button variant={tone === "primary" ? "default" : "secondary"} className={`action-button action-button-${tone} ${className}`.trim()} type={type} {...props}>{children}</Button>;
}
