"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import { coverUrl, slugify, type Novel } from "@/lib/api/novels";
import { CoverImage } from "./cover-image";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";

type ReadingBook = Novel & { chapter_id: number | null; progress: number };

export function ContinueReading() {
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    libraryRequest<ReaderAccount | null>("/me")
      .then(me => me ? libraryRequest<ReadingBook[]>("/shelf") : [])
      .then(data => { if (active) setBooks(data.filter(b => b.chapter_id).slice(0, 3)); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  if (error) return <p className="inline-notice">โหลดประวัติการอ่านไม่สำเร็จ <Link href="/shelf">ลองเปิดชั้นหนังสือ</Link></p>;
  if (!books.length) return null;

  return (
    <section className="continue-section">
      <SectionHeading eyebrow="อ่านค้างไว้ล่าสุด" title="อ่านต่อจากครั้งล่าสุด" action={<Link href="/shelf">ไปชั้นหนังสือ →</Link>} />
      <div className="continue-grid">
        {books.map(book => {
          const percent = Math.round(book.progress * 100);
          const continueHref = `/novel/${book.id}/${slugify(book.title)}/chapter/${book.chapter_id}/continue`;
          return (
            <article className="continue-book" key={book.id}>
              <Link className="continue-cover" href={continueHref} aria-label={`อ่านต่อ ${book.title}`}>
                <CoverImage src={coverUrl(book.cover)} alt={`ปก ${book.title}`} title={book.title} category={book.category} tone={book.id % 4} sizes="90px" />
              </Link>
              <div className="continue-info">
                <span className="novel-category">{book.category}</span>
                <h3><Link href={`/novel/${book.id}/${slugify(book.title)}`}>{book.title}</Link></h3>
                <div className="continue-progress-row">
                  <Progress value={percent} aria-label={`อ่านแล้ว ${percent} เปอร์เซ็นต์`} />
                  <span className="continue-percent">{percent}%</span>
                </div>
                <Button asChild size="sm" className="continue-cta">
                  <Link href={continueHref}>อ่านต่อ <span aria-hidden="true">→</span></Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

