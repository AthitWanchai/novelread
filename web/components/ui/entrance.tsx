"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

type EntranceProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section";
} & Omit<ComponentProps<typeof motion.div>, "children" | "className" | "initial" | "animate" | "transition">;

export function Entrance({ children, className, delay = 0, as = "div", ...props }: EntranceProps) {
  const reduceMotion = useReducedMotion();
  const Component = as === "section" ? motion.section : motion.div;
  return <Component className={className} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay, ease: "easeOut" }} {...props}>{children}</Component>;
}
