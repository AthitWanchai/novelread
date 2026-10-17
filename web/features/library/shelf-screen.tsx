"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { NovelCard } from "@/components/novel/novel-card";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import type { Novel } from "@/lib/api/novels";
import { SectionHeading } from "@/components/ui/section-heading";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { ActionLink } from "@/components/ui/action-link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { slugify } from "@/lib/api/novels";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type ShelfNovel = Novel & { chapter_id: number | null; progress: number; followed: boolean };

export function ShelfScreen() {
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [books, setBooks] = useState<ShelfNovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"reading" | "following">("reading");
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadShelf = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await libraryRequest<ReaderAccount | null>("/me");
      setAccount(me);
      if (me) setBooks(await libraryRequest<ShelfNovel[]>("/shelf"));
      else setBooks([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดชั้นหนังสือไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadShelf(); }, [loadShelf]);

  async function toggleFollow(book: ShelfNovel) {
    if (busyId === book.id) return;
    const nextFollowed = !book.followed;
    setBusyId(book.id);
    setBooks(current => current.map(item => item.id === book.id ? { ...item, followed: nextFollowed } : item));
    try {
      await libraryRequest(`/shelf/${book.id}`, "PUT", { followed: nextFollowed });
    } catch (e) {
      setBooks(current => current.map(item => item.id === book.id ? { ...item, followed: !nextFollowed } : item));
      setError(e instanceof Error ? e.message : "อัปเดตการติดตามไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  const readingBooks = books.filter(book => Boolean(book.chapter_id));
  const followingBooks = books.filter(book => Boolean(book.followed));
  const visible = tab === "reading" ? readingBooks : followingBooks;

  return (
    <div className="content-shell shelf-page">
      <SectionHeading
        as="h1"
        eyebrow="คลังส่วนตัวของคุณ"
        title="ชั้นหนังสือ"
        action={<span className="result-count">{books.length} เรื่อง</span>}
      />
      {loading ? (
        <FeedbackPanel role="status">กำลังเปิดชั้นหนังสือ…</FeedbackPanel>
      ) : error && !account ? (
        <FeedbackPanel variant="notice" role="alert" title="โหลดชั้นหนังสือไม่สำเร็จ">
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={() => void loadShelf()}>ลองอีกครั้ง</Button>
        </FeedbackPanel>
      ) : !account ? (
        <FeedbackPanel title="เข้าสู่ระบบเพื่อดูชั้นหนังสือ">
          <p>บัญชีจะช่วยบันทึกเรื่องที่ติดตามและตำแหน่งอ่านของคุณ</p>
          <ActionLink className="hero-cta" href="/account?next=%2Fshelf">เข้าสู่ระบบ</ActionLink>
        </FeedbackPanel>
      ) : (
        <Tabs className="shelf-tabs" value={tab} onValueChange={value => setTab(value as "reading" | "following")}>
          <TabsList aria-label="ประเภทในชั้นหนังสือ">
            <TabsTrigger value="reading">กำลังอ่าน ({readingBooks.length})</TabsTrigger>
            <TabsTrigger value="following">ติดตามอยู่ ({followingBooks.length})</TabsTrigger>
          </TabsList>
          <TabsContent value={tab}>
            {error ? (
              <FeedbackPanel variant="notice" role="alert" title="โหลดข้อมูลชั้นหนังสือไม่สำเร็จ">
                <p>{error}</p>
                <Button type="button" variant="outline" onClick={() => void loadShelf()}>ลองอีกครั้ง</Button>
              </FeedbackPanel>
            ) : visible.length ? (
              <div className="novel-grid shelf-grid">
                {visible.map(book => {
                  const percent = Math.round(book.progress * 100);
                  const novelSlug = slugify(book.title);
                  const continueHref = book.chapter_id
                    ? `/novel/${book.id}/${novelSlug}/chapter/${book.chapter_id}/continue`
                    : `/novel/${book.id}/${novelSlug}`;
                  return (
                    <article className="shelf-item" key={book.id}>
                      <NovelCard novel={book} />
                      <div className="shelf-progress">
                        {book.chapter_id ? (
                          <>
                            <div className="shelf-progress-header">
                              <span>อ่านแล้ว {percent}%</span>
                              <Link className="shelf-continue-link" href={continueHref}>อ่านต่อ →</Link>
                            </div>
                            <Progress value={percent} aria-label={`อ่านแล้ว ${percent} เปอร์เซ็นต์`} />
                          </>
                        ) : (
                          <div className="shelf-progress-header">
                            <span>ยังไม่ได้เริ่มอ่าน</span>
                            <Link className="shelf-continue-link" href={continueHref}>เปิดเรื่อง →</Link>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`shelf-follow-toggle${book.followed ? " is-following" : ""}`}
                          disabled={busyId === book.id}
                          onClick={() => void toggleFollow(book)}
                        >
                          {book.followed ? <><Check aria-hidden="true" /> ติดตามอยู่</> : <><Bookmark aria-hidden="true" /> ติดตามเรื่อง</>}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <FeedbackPanel title={tab === "reading" ? "ยังไม่มีประวัติการอ่าน" : "ยังไม่ได้ติดตามนิยาย"}>
                <p>เลือกนิยายที่ชอบ แล้วกลับมาอ่านต่อได้ที่นี่</p>
                <ActionLink className="hero-cta" href="/">ค้นพบนิยาย</ActionLink>
              </FeedbackPanel>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

