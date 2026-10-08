"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import { coverUrl, slugify, type Novel } from "@/lib/api/novels";
import { CoverImage } from "./cover-image";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
type ReadingBook = Novel & { chapter_id: number | null; progress: number };
export function ContinueReading() {
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; libraryRequest<ReaderAccount | null>("/me").then(me => me ? libraryRequest<ReadingBook[]>("/shelf") : []).then(data => { if (active) setBooks(data.filter(b => b.chapter_id).slice(0, 3)); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, []);
  if (error) return <p className="inline-notice">โหลดประวัติการอ่านไม่สำเร็จ <Link href="/shelf">ลองเปิดชั้นหนังสือ</Link></p>;
  if (!books.length) return null;
  return <section className="continue-section"><div className="section-heading"><h2>อ่านต่อจากครั้งล่าสุด</h2><Link href="/shelf">ไปชั้นหนังสือ</Link></div><div className="continue-grid">{books.map(book => <article className="continue-book" key={book.id}><div className="continue-cover"><CoverImage src={coverUrl(book.cover)} alt={`ปก ${book.title}`} title={book.title} category={book.category} tone={book.id % 4} sizes="90px" /></div><div><h3>{book.title}</h3><Progress value={book.progress * 100} aria-label={`อ่านแล้ว ${Math.round(book.progress * 100)} เปอร์เซ็นต์`} /><Button asChild size="sm"><Link href={`/novel/${book.id}/${slugify(book.title)}/chapter/${book.chapter_id}/continue`}>อ่านต่อ</Link></Button></div></article>)}</div></section>;
}
