import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
};

export function SectionHeading({ eyebrow, title, action, as = "h2", className = "" }: SectionHeadingProps) {
  const Heading = as;
  return (
    <div className={`section-heading ${className}`.trim()}>
      <div><span className="section-kicker">{eyebrow}</span><Heading>{title}</Heading></div>
      {action ? <div className="section-heading-action">{action}</div> : null}
    </div>
  );
}
