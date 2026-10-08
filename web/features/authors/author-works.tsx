"use client";

import { useRef, useState } from "react";
import { libraryRequest } from "@/lib/api/client";
import type { AuthorPage } from "@/lib/api/novels";
import { NovelCard } from "@/components/novel/novel-card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FeedbackPanel } from "@/components/ui/feedback-panel";

export function AuthorWorks({ initial }: { initial: AuthorPage }) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  async function load(nextStatus: string, append = false) {
    const request = ++sequence.current;
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ limit: "12", offset: String(append ? data.next_offset ?? 0 : 0) });
      if (nextStatus !== "all") query.set("status", nextStatus);
      const result = await libraryRequest<AuthorPage>(`/authors/${initial.author.id}?${query}`);
      if (request !== sequence.current) return;
      setData(previous => ({ ...result, books: append ? [...previous.books, ...result.books] : result.books }));
      setStatus(nextStatus);
    } catch (e) { if (request === sequence.current) setError(e instanceof Error ? e.message : "โหลดผลงานไม่สำเร็จ"); }
    finally { if (request === sequence.current) setBusy(false); }
  }
  return <section className="author-works" aria-busy={busy}>
    <div className="section-heading"><h2>ผลงานทั้งหมด <small>{data.total} เรื่อง</small></h2><Select value={status} disabled={busy} onValueChange={value => void load(value)}><SelectTrigger className="compact-select" aria-label="สถานะผลงาน"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem><SelectItem value="กำลังเขียน">กำลังเขียน</SelectItem><SelectItem value="จบแล้ว">จบแล้ว</SelectItem></SelectContent></Select></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="novel-grid author-grid">{data.books.map(book => <NovelCard key={book.id} novel={book} />)}</div>
    {!data.books.length && <FeedbackPanel title="ยังไม่มีผลงานที่เผยแพร่ในสถานะนี้" />}
    <div className="load-more" aria-live="polite">{data.next_offset !== null ? <Button variant="outline" disabled={busy} onClick={() => void load(status, true)}>{busy ? "กำลังโหลด…" : "ดูผลงานเพิ่มเติม"}</Button> : data.books.length > 0 && <p>แสดงผลงานครบแล้ว {data.total} เรื่อง</p>}</div>
  </section>;
}
