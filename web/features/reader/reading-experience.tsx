"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import { slugify, type ChapterSummary } from "@/lib/api/novels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Props = {
  bookId: number;
  novelHref: string;
  chapterId: number;
  content: string;
  published: boolean;
  chapterIndex: number;
  chapterCount: number;
  chapters?: ChapterSummary[];
  followedInitially?: boolean;
};
type Position = { chapter_id: number; progress: number; anchor: { paragraph: number; character: number }; updatedAt?: number };

export function ReadingExperience({
  bookId,
  novelHref,
  chapterId,
  content,
  published,
  chapterIndex,
  chapterCount,
  chapters = [],
  followedInitially = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const paragraphs = content.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
  const contentRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<Position>({ chapter_id: chapterId, progress: 0, anchor: { paragraph: 0, character: 0 } });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const accountRef = useRef<ReaderAccount | null>(null);
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [accountStatus, setAccountStatus] = useState<"loading" | "ready" | "error">("loading");
  const [size, setSize] = useState(21);
  const [theme, setTheme] = useState("");
  const [followed, setFollowed] = useState(followedInitially);
  const [progressPercent, setProgressPercent] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");
  const storageKey = (userId?: number | string) => `read:${userId ? `user:${userId}` : "guest"}:${bookId}`;

  const persist = useCallback(async (position: Position, user: ReaderAccount | null) => {
    positionRef.current = position;
    try { localStorage.setItem(storageKey(user?.id), JSON.stringify({ ...position, updatedAt: Date.now() })); } catch { /* storage can be disabled */ }
    if (user && published) {
      try {
        await libraryRequest(`/shelf/${bookId}`, "PUT", { chapter_id: position.chapter_id, progress: position.progress, anchor: position.anchor });
        setSaveMessage("บันทึกตำแหน่งอ่านแล้ว");
      } catch { setSaveMessage("บันทึกไว้ในเบราว์เซอร์แล้ว"); }
    }
  }, [bookId, published]);

  useEffect(() => {
    const savedSize = Number(localStorage.getItem("reading-size") || 21);
    const savedTheme = localStorage.getItem("reading-theme") || "";
    setSize(Math.max(17, Math.min(30, savedSize)));
    setTheme(["", "theme-sepia", "theme-dark"].includes(savedTheme) ? savedTheme : "");
    let active = true;
    libraryRequest<ReaderAccount | null>("/me").then(async me => {
      if (!active) return;
      setAccount(me); accountRef.current = me;
      const userLocal = JSON.parse(localStorage.getItem(storageKey(me?.id)) || "null") as Position | null;
      const guestLocal = me ? (JSON.parse(localStorage.getItem(storageKey()) || "null") as Position | null) : null;
      const local = userLocal ?? guestLocal;
      let saved: { chapter_id: number | null; progress: number; anchor: Position["anchor"] } | undefined;
      if (me) {
        try {
          const shelf = await libraryRequest<Array<{ id: number; chapter_id: number | null; progress: number; anchor: Position["anchor"]; followed: boolean }>>("/shelf");
          const shelfBook = shelf.find(item => item.id === bookId);
          saved = shelfBook;
          setFollowed(Boolean(shelfBook?.followed));
        } catch { setSaveMessage("โหลดสถานะชั้นหนังสือไม่สำเร็จ"); }
      }
      if (!active) return;
      const position = saved?.chapter_id === chapterId
        ? { chapter_id: chapterId, progress: saved.progress, anchor: saved.anchor ?? { paragraph: 0, character: 0 } }
        : local?.chapter_id === chapterId
          ? local
          : { chapter_id: chapterId, progress: 0, anchor: { paragraph: 0, character: 0 } };
      positionRef.current = position;
      setProgressPercent(Math.round(position.progress * 100));
      requestAnimationFrame(() => {
        const paragraph = contentRef.current?.querySelector<HTMLElement>(`[data-paragraph="${position.anchor.paragraph}"]`);
        const node = paragraph?.firstChild;
        if (node?.nodeType === Node.TEXT_NODE && node.textContent) {
          const range = document.createRange(); const offset = Math.min(position.anchor.character, Math.max(0, node.textContent.length - 1));
          range.setStart(node, offset); range.setEnd(node, Math.min(node.textContent.length, offset + 1));
          window.scrollBy(0, range.getBoundingClientRect().top - 110);
        } else if (position.progress > 0 && contentRef.current) {
          window.scrollTo(0, contentRef.current.offsetTop + position.progress * contentRef.current.offsetHeight - 110);
        }
      });
      setAccountStatus("ready");
    }).catch(() => { accountRef.current = null; setAccountStatus("error"); setSaveMessage("ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองใหม่"); });
    return () => { active = false; clearTimeout(timer.current); };
  }, [bookId, chapterId]);

  const capture = useCallback(() => {
    const container = contentRef.current;
    const items = container ? [...container.querySelectorAll<HTMLElement>("[data-paragraph]")] : [];
    if (!container || items.length === 0) return;
    const line = 112;
    let paragraphIndex = items.findIndex(item => item.getBoundingClientRect().bottom > line);
    if (paragraphIndex < 0) paragraphIndex = items.length - 1;
    const paragraph = items[paragraphIndex];
    const textLength = paragraph.textContent?.length ?? 0;
    const rect = paragraph.getBoundingClientRect();
    const character = Math.max(0, Math.min(textLength, Math.round(((line - rect.top) / Math.max(1, rect.height)) * textLength)));
    const total = items.reduce((sum, item) => sum + (item.textContent?.length ?? 0), 0);
    const before = items.slice(0, paragraphIndex).reduce((sum, item) => sum + (item.textContent?.length ?? 0), 0);
    const progress = Math.max(0, Math.min(1, (before + character) / Math.max(1, total)));
    const position: Position = { chapter_id: chapterId, progress, anchor: { paragraph: paragraphIndex, character } };
    positionRef.current = position;
    setProgressPercent(Math.round(progress * 100));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(position, accountRef.current); }, 900);
  }, [chapterId, persist]);

  const flushPosition = useCallback(() => {
    clearTimeout(timer.current);
    void persist(positionRef.current, accountRef.current);
  }, [persist]);

  useEffect(() => {
    window.addEventListener("scroll", capture, { passive: true });
    window.addEventListener("pagehide", flushPosition);
    return () => { window.removeEventListener("scroll", capture); window.removeEventListener("pagehide", flushPosition); flushPosition(); };
  }, [capture, flushPosition]);

  function updateSize(delta: number) {
    const next = Math.max(17, Math.min(30, size + delta)); setSize(next); localStorage.setItem("reading-size", String(next));
  }
  function updateTheme(value: string) { const next = value === "light" ? "" : value; setTheme(next); localStorage.setItem("reading-theme", next); }
  async function toggleFollow() {
    if (accountStatus === "loading") return;
    if (accountStatus === "error") { setSaveMessage("ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองใหม่"); return; }
    if (!account) { router.push(`/account?next=${encodeURIComponent(pathname)}`); return; }
    const next = !followed; setFollowed(next);
    try { await libraryRequest(`/shelf/${bookId}`, "PUT", { followed: next }); }
    catch { setFollowed(!next); setSaveMessage("ติดตามเรื่องไม่ได้ กรุณาลองอีกครั้ง"); }
  }

  function jumpToChapter(nextId: string) {
    const target = chapters.find(item => String(item.id) === nextId);
    if (!target || target.id === chapterId) return;
    flushPosition();
    router.push(`${novelHref}/chapter/${target.id}/${slugify(target.title)}`);
  }

  return (
    <>
      <div className="reading-tools">
        <div className="reading-tools-left">
          <Link className="back-link" href={novelHref}>← กลับหน้าเรื่อง</Link>
          {chapters.length > 1 && (
            <Select value={String(chapterId)} onValueChange={jumpToChapter}>
              <SelectTrigger aria-label="เลือกตอนนิยาย" className="reader-chapter-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((item, idx) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    ตอนที่ {idx + 1}: {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="reading-tool-actions">
          <Button variant="outline" size="icon" type="button" className="reader-tool-button" aria-label="ลดขนาดตัวอักษร" onClick={() => updateSize(-1)}>ก−</Button>
          <span className="reader-size-label" aria-label={`ขนาดตัวอักษร ${size} พิกเซล`}>{size}</span>
          <Button variant="outline" size="icon" type="button" className="reader-tool-button" aria-label="เพิ่มขนาดตัวอักษร" onClick={() => updateSize(1)}>ก+</Button>
          <Select value={theme || "light"} onValueChange={updateTheme}>
            <SelectTrigger aria-label="พื้นหลังการอ่าน" className="reading-theme-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">สว่าง</SelectItem>
              <SelectItem value="theme-sepia">กระดาษ</SelectItem>
              <SelectItem value="theme-dark">มืด</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="reading-progress-track" aria-hidden="true">
          <div className="reading-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div ref={contentRef} className={`reader-content ${theme}`} style={{ fontSize: `${size}px` }}>
        {paragraphs.map((paragraph, index) => <p data-paragraph={index} key={index}>{paragraph}</p>)}
      </div>
      <div className="reader-footer">
        <span>ตอนที่ {chapterIndex + 1} / {chapterCount} · อ่านแล้ว {progressPercent}%</span>
        <div className="reader-footer-actions">
          {saveMessage && <span className="reader-save-status" role="status">{saveMessage}</span>}
          <Button
            variant="outline"
            size="sm"
            type="button"
            className={`reader-follow-btn${followed ? " is-following" : ""}`}
            onClick={toggleFollow}
            disabled={accountStatus !== "ready"}
          >
            {accountStatus === "loading" ? "กำลังตรวจสอบบัญชี…" : followed ? <><Check aria-hidden="true" /> ติดตามอยู่</> : <><Bookmark aria-hidden="true" /> ติดตามเรื่อง</>}
          </Button>
        </div>
      </div>
    </>
  );
}

