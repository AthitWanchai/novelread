import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Brand() {
  return <Link href="/" className="brand" aria-label="Novelread หน้าแรก"><BookOpen aria-hidden="true" /><span>novelread</span></Link>;
}
