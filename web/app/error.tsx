"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section className="content-shell error-page" role="alert">
    <span className="section-kicker">NOVELREAD</span>
    <h1>โหลดหน้านี้ไม่สำเร็จ</h1>
    <p>ลองอีกครั้งได้เลย หากยังไม่สำเร็จ ให้กลับไปค้นหานิยายก่อนนะ</p>
    <div className="error-actions"><Button type="button" onClick={retry}>ลองอีกครั้ง</Button><Button asChild variant="outline"><Link href="/">กลับหน้าค้นหา</Link></Button></div>
  </section>;
}
