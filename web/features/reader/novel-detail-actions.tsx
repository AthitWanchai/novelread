"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, List } from "lucide-react";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import { slugify, type ChapterSummary } from "@/lib/api/novels";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";

type Props = {
  bookId: number;
  bookTitle: string;
  chapters: ChapterSummary[];
};

type ShelfEntry = {
  id: number;
  chapter_id: number | null;
  progress: number;
  followed: boolean;
};

export function NovelDetailActions({ bookId, bookTitle, chapters }: Props) {
  const router = useRouter();
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [followed, setFollowed] = useState(false);
  const [savedChapterId, setSavedChapterId] = useState<number | null>(null);
  const [busyFollow, setBusyFollow] = useState(false);

  useEffect(() => {
    let active = true;
    const guestRaw = typeof window !== "undefined" ? localStorage.getItem(`read:guest:${bookId}`) : null;
    const guestPos = guestRaw ? (JSON.parse(guestRaw) as { chapter_id?: number } | null) : null;

    libraryRequest<ReaderAccount | null>("/me")
      .then(async me => {
        if (!active) return;
        setAccount(me);
        if (me) {
          const userRaw = localStorage.getItem(`read:user:${me.id}:${bookId}`);
          const userPos = userRaw ? (JSON.parse(userRaw) as { chapter_id?: number } | null) : null;
          try {
            const shelf = await libraryRequest<ShelfEntry[]>("/shelf");
            if (!active) return;
            const entry = shelf.find(item => item.id === bookId);
            if (entry) {
              setFollowed(Boolean(entry.followed));
              setSavedChapterId(entry.chapter_id ?? userPos?.chapter_id ?? guestPos?.chapter_id ?? null);
            } else if (userPos?.chapter_id) {
              setSavedChapterId(userPos.chapter_id);
            } else if (guestPos?.chapter_id) {
              setSavedChapterId(guestPos.chapter_id);
            }
          } catch {
            if (userPos?.chapter_id) setSavedChapterId(userPos.chapter_id);
            else if (guestPos?.chapter_id) setSavedChapterId(guestPos.chapter_id);
          }
        } else if (guestPos?.chapter_id) {
          setSavedChapterId(guestPos.chapter_id);
        }
      })
      .catch(() => {
        if (active && guestPos?.chapter_id) setSavedChapterId(guestPos.chapter_id);
      })
      .finally(() => {
        if (active) setStatus("ready");
      });

    return () => { active = false; };
  }, [bookId]);

  async function toggleFollow() {
    if (status === "loading" || busyFollow) return;
    if (!account) {
      router.push(`/account?next=${encodeURIComponent(`/novel/${bookId}/${slugify(bookTitle)}`)}`);
      return;
    }
    const next = !followed;
    setFollowed(next);
    setBusyFollow(true);
    try {
      await libraryRequest(`/shelf/${bookId}`, "PUT", { followed: next });
    } catch {
      setFollowed(!next);
    } finally {
      setBusyFollow(false);
    }
  }

  const firstChapter = chapters[0];
  const savedChapterIndex = savedChapterId ? chapters.findIndex(c => c.id === savedChapterId) : -1;
  const savedChapter = savedChapterIndex >= 0 ? chapters[savedChapterIndex] : undefined;
  const bookSlug = slugify(bookTitle);

  return (
    <div className="detail-actions">
      {savedChapter ? (
        <>
          <ActionLink
            className="hero-cta detail-cta"
            href={`/novel/${bookId}/${bookSlug}/chapter/${savedChapter.id}/${slugify(savedChapter.title)}`}
          >
            อ่านต่อ ตอนที่ {savedChapterIndex + 1} <span aria-hidden="true">→</span>
          </ActionLink>
          {firstChapter && firstChapter.id !== savedChapter.id && (
            <ActionLink
              className="detail-contents-link"
              tone="secondary"
              href={`/novel/${bookId}/${bookSlug}/chapter/${firstChapter.id}/${slugify(firstChapter.title)}`}
            >
              เริ่มอ่านตอนแรก
            </ActionLink>
          )}
        </>
      ) : (
        firstChapter && (
          <ActionLink
            className="hero-cta detail-cta"
            href={`/novel/${bookId}/${bookSlug}/chapter/${firstChapter.id}/${slugify(firstChapter.title)}`}
          >
            เริ่มอ่านตอนแรก <span aria-hidden="true">→</span>
          </ActionLink>
        )
      )}
      <ActionLink className="detail-contents-link" tone="secondary" href="#chapters">
        <List aria-hidden="true" /> ดูสารบัญ
      </ActionLink>
      <Button
        type="button"
        variant="outline"
        className={`detail-contents-link detail-follow-btn${followed ? " is-following" : ""}`}
        onClick={() => void toggleFollow()}
        disabled={status === "loading" || busyFollow}
      >
        {followed ? <><Check aria-hidden="true" /> ติดตามอยู่</> : <><Bookmark aria-hidden="true" /> ติดตามเรื่อง</>}
      </Button>
    </div>
  );
}
