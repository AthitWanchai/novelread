import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type FeedbackPanelProps = {
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
  variant?: "empty" | "notice";
  className?: string;
  role?: "status" | "alert";
};

export function FeedbackPanel({ title, children, icon, variant = "empty", className = "", role }: FeedbackPanelProps) {
  if (variant === "notice") {
    return <Card className={`notice-card ${className}`.trim()} role={role ?? "alert"}>
      {icon ? <span className="notice-icon" aria-hidden="true">{icon}</span> : null}
      <div>{title ? <strong>{title}</strong> : null}{children ? <div className="feedback-copy">{children}</div> : null}</div>
    </Card>;
  }

  return <Card className={`empty-library ${className}`.trim()} role={role}>
    {icon ? <span className="empty-mark" aria-hidden="true">{icon}</span> : null}
    {title ? <h3>{title}</h3> : null}
    {children ? <div className="feedback-copy">{children}</div> : null}
  </Card>;
}
