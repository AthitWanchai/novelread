"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Upload, ExternalLink, Check, Trash2 } from "lucide-react";
import { NovelCard } from "@/components/novel/novel-card";
import { CoverImage } from "@/components/novel/cover-image";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import { SectionHeading } from "@/components/ui/section-heading";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { ActionButton, ActionLink } from "@/components/ui/action-link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { coverUrl, slugify, type ChapterSummary, type Novel } from "@/lib/api/novels";

const categories = ["แฟนตาซี", "รักโรแมนติก", "วาย", "สืบสวน", "ผจญภัย", "ดราม่า", "อื่น ๆ"];
type BookForm = Pick<Novel, "title" | "pen_name" | "summary" | "category" | "tags" | "cover" | "rating" | "status">;
const blankBook: BookForm = { title: "", pen_name: "", summary: "", category: "แฟนตาซี", tags: "", cover: "", rating: "ทั่วไป", status: "กำลังเขียน" };

export function WriterDashboard() {
  const router = useRouter();
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [books, setBooks] = useState<Novel[]>([]);
  const [form, setForm] = useState<BookForm>(blankBook);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    libraryRequest<ReaderAccount | null>("/me").then(async me => {
      setAccount(me);
      if (me) setBooks(await libraryRequest<Novel[]>("/books?mine=true"));
    }).catch(e => setError(e.message)).finally(() => setBusy(false));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await libraryRequest<{ id: number }>("/books", "POST", { ...form, pen_name: form.pen_name.trim() || account?.name || "" });
      router.push(`/studio/${result.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "สร้างเรื่องไม่ได้"); setBusy(false); }
  }

  if (busy && !account) return <div className="content-shell"><FeedbackPanel>กำลังโหลดพื้นที่นักเขียน…</FeedbackPanel></div>;
  if (error && !account) return <div className="content-shell"><FeedbackPanel variant="notice" role="alert" title="โหลดพื้นที่นักเขียนไม่สำเร็จ"><p>{error}</p></FeedbackPanel></div>;
  if (!account) return <div className="content-shell"><FeedbackPanel title="เข้าสู่ระบบเพื่อเริ่มเขียนนิยาย"><p>ผลงานและฉบับร่างจะบันทึกไว้ในบัญชีของคุณ</p><ActionLink href="/account?next=%2Fstudio" className="hero-cta">เข้าสู่ระบบ</ActionLink></FeedbackPanel></div>;

  return (
    <div className="content-shell">
      <SectionHeading
        className="writer-dashboard-heading"
        as="h1"
        eyebrow="สตูดิโอนักเขียน"
        title="พื้นที่นักเขียน"
        action={
          <ActionButton className="search-button new-story-button" onClick={() => { setCreating(!creating); setError(""); }}>
            {creating ? "ปิดฟอร์มสร้างเรื่อง" : "＋ สร้างเรื่องใหม่"}
          </ActionButton>
        }
      />
      <p className="studio-intro">จัดการนิยาย อัปโหลดปก เขียนตอนใหม่ และเผยแพร่เมื่อพร้อม</p>
      {creating && (
        <Card asChild className="writer-panel">
          <form onSubmit={create}>
            <div className="writer-panel-heading">
              <h2>เริ่มเรื่องใหม่</h2>
              <Button variant="ghost" type="button" className="text-button" onClick={() => setCreating(false)}>ปิด</Button>
            </div>
            <BookFields value={form} onChange={setForm} defaultPenName={account.name} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="writer-form-footer">
              <ActionButton type="submit" className="search-button" disabled={busy}>สร้างนิยาย</ActionButton>
            </div>
          </form>
        </Card>
      )}
      {error && !creating && <p className="form-error" role="alert">{error}</p>}
      {books.length ? (
        <div className="novel-grid writer-grid">
          {books.map(book => (
            <article className="writer-item" key={book.id}>
              <NovelCard novel={book} />
              <Link className="writer-edit-link" href={`/studio/${book.id}`}>จัดการเรื่องและตอน</Link>
            </article>
          ))}
        </div>
      ) : !creating && (
        <FeedbackPanel icon="✎" title="เรื่องแรกของคุณเริ่มตรงนี้">
          <p>ตั้งชื่อเรื่อง เพิ่มคำโปรย แล้วเขียนตอนแรกได้เลย</p>
          <ActionButton className="hero-cta" onClick={() => setCreating(true)}>สร้างนิยาย</ActionButton>
        </FeedbackPanel>
      )}
    </div>
  );
}

function BookFields({ value, onChange, defaultPenName, tone = 0 }: { value: BookForm; onChange: (book: BookForm) => void; defaultPenName?: string; tone?: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const change = (key: keyof BookForm, fieldValue: string) => onChange({ ...value, [key]: fieldValue });

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("ปกต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadNotice("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่ได้"));
        reader.readAsDataURL(file);
      });
      const uploaded = await libraryRequest<{ url: string }>("/covers", "POST", { data: base64 });
      change("cover", uploaded.url);
      setUploadNotice("อัปโหลดปกแล้ว");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "อัปโหลดปกไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="book-editor-grid">
      <div className="writer-fields">
        <Label>ชื่อเรื่อง<Input required maxLength={200} value={value.title} onChange={e => change("title", e.target.value)} placeholder="ตั้งชื่อเรื่องให้น่าจดจำ" /></Label>
        <Label>นามปากกา<Input required maxLength={80} value={value.pen_name || defaultPenName || ""} onChange={e => change("pen_name", e.target.value)} /></Label>
        <Label className="writer-wide">คำโปรย / เรื่องย่อ<Textarea rows={4} maxLength={10000} value={value.summary} onChange={e => change("summary", e.target.value)} placeholder="แนะนำเรื่องย่อให้ผู้อ่านอยากติดตาม…" /></Label>
        <Label>หมวด<Select value={value.category} onValueChange={next => change("category", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
        <Label>สถานะ<Select value={value.status} onValueChange={next => change("status", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="กำลังเขียน">กำลังเขียน</SelectItem><SelectItem value="จบแล้ว">จบแล้ว</SelectItem></SelectContent></Select></Label>
        <Label>เรตเนื้อหา<Select value={value.rating} onValueChange={next => change("rating", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ทั่วไป">ทั่วไป</SelectItem><SelectItem value="18+">18+</SelectItem></SelectContent></Select></Label>
        <Label>แท็ก<Input maxLength={300} value={value.tags} onChange={e => change("tags", e.target.value)} placeholder="คั่นแต่ละแท็กด้วยเครื่องหมายจุลภาค" /></Label>
        <Label className="writer-wide">
          ลิงก์ภาพปก หรืออัปโหลดไฟล์ปก
          <Input
            type="text"
            inputMode="url"
            maxLength={2000}
            value={value.cover}
            onChange={e => { change("cover", e.target.value); setUploadNotice(""); }}
            placeholder="https://… หรือกดปุ่มอัปโหลดรูปปกด้านขวา"
          />
        </Label>
      </div>
      <div className="cover-manager">
        <span className="ui-label">ตัวอย่างปกนิยาย (2:3)</span>
        <div className="cover-preview">
          <CoverImage
            src={coverUrl(value.cover)}
            alt={value.title ? `ปกเรื่อง ${value.title}` : "ตัวอย่างปกนิยาย"}
            title={value.title.trim() || "ชื่อเรื่องของคุณ"}
            category={value.category}
            tone={tone}
            sizes="180px"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="เลือกไฟล์รูปปก"
          onChange={e => void handleFileChange(e)}
        />
        <div className="cover-upload-controls">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            <Upload aria-hidden="true" /> {uploading ? "กำลังอัปโหลด…" : "อัปโหลดปก"}
          </Button>
          {value.cover && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { change("cover", ""); setUploadNotice(""); }}>
              <Trash2 aria-hidden="true" /> ล้างปก
            </Button>
          )}
        </div>
        <p className="help-copy">รองรับ PNG, JPEG, WebP ขนาดไม่เกิน 5 MB</p>
        {uploadNotice && <p className="form-success" role="status"><Check aria-hidden="true" /> {uploadNotice}</p>}
        {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
      </div>
    </div>
  );
}

type LocalDraft = { title: string; content: string; published: boolean; savedAt: number };

export function WriterEditor({ id }: { id: string }) {
  const router = useRouter();
  const isNew = id === "new";
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [book, setBook] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [bookForm, setBookForm] = useState<BookForm>(blankBook);
  const [chapter, setChapter] = useState<{ id: number | null; title: string; content: string; published: boolean }>({ id: null, title: "", content: "", published: false });
  const [chapterDirty, setChapterDirty] = useState(false);
  const [recoverableDraft, setRecoverableDraft] = useState<LocalDraft | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const draftKey = (chapterId: number | null) => `draft:book:${id}:chapter:${chapterId ?? "new"}`;

  useEffect(() => {
    let active = true;
    libraryRequest<ReaderAccount | null>("/me").then(async me => {
      if (!active) return;
      setAccount(me);
      if (me && !isNew) {
        const result = await libraryRequest<Novel>(`/books/${id}`);
        if (!active) return;
        if (!result.is_owner) throw new Error("แก้ไขได้เฉพาะผลงานของคุณ");
        setBook(result); setChapters(result.chapters ?? []);
        setBookForm({ title: result.title, pen_name: result.pen_name, summary: result.summary, category: result.category, tags: result.tags, cover: result.cover, rating: result.rating, status: result.status });
        try {
          const savedDraft = JSON.parse(localStorage.getItem(`draft:book:${id}:chapter:new`) || "null") as LocalDraft | null;
          if (savedDraft && (savedDraft.title || savedDraft.content)) {
            setRecoverableDraft(savedDraft);
          }
        } catch { /* ignore */ }
      }
    }).catch(e => setError(e.message)).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id, isNew]);

  useEffect(() => {
    if (isNew || !chapterDirty) return;
    const timer = setTimeout(() => {
      try {
        const payload: LocalDraft = { title: chapter.title, content: chapter.content, published: chapter.published, savedAt: Date.now() };
        localStorage.setItem(draftKey(chapter.id), JSON.stringify(payload));
      } catch { /* ignore storage quota */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [id, isNew, chapter, chapterDirty]);

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (isNew) {
        const created = await libraryRequest<{ id: number }>("/books", "POST", { ...bookForm, pen_name: bookForm.pen_name.trim() || account?.name || "" });
        router.replace(`/studio/${created.id}`); router.refresh();
      } else {
        const values = { ...bookForm, pen_name: bookForm.pen_name.trim() || account?.name || "" };
        await libraryRequest(`/books/${id}`, "PUT", values);
        setBook(current => current ? { ...current, ...values } : current);
        setNotice("บันทึกรายละเอียดเรื่องเรียบร้อยแล้ว");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกเรื่องไม่ได้"); }
    finally { setSaving(false); }
  }

  async function saveChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const previousDraftKey = draftKey(chapter.id);
    try {
      const route = chapter.id ? `/books/${id}/chapters/${chapter.id}` : `/books/${id}/chapters`;
      const result = await libraryRequest<{ id: number }>(route, chapter.id ? "PUT" : "POST", { title: chapter.title, content: chapter.content, published: chapter.published });
      const updated = await libraryRequest<Novel>(`/books/${id}`);
      setBook(updated); setChapters(updated.chapters ?? []);
      const saved = (updated.chapters ?? []).find(item => item.id === result.id);
      setChapter(saved ? { id: saved.id, title: saved.title, content: chapter.content, published: saved.published } : { id: null, title: "", content: "", published: false });
      setChapterDirty(false);
      setRecoverableDraft(null);
      try { localStorage.removeItem(previousDraftKey); localStorage.removeItem(draftKey(result.id)); } catch { /* ignore */ }
      setNotice(chapter.published ? "บันทึกและเผยแพร่ตอนเรียบร้อยแล้ว" : "บันทึกฉบับร่างเรียบร้อยแล้ว");
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกตอนไม่ได้"); }
    finally { setSaving(false); }
  }

  async function moveChapter(index: number, direction: -1 | 1) {
    const next = [...chapters]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSaving(true); setError(""); setNotice("");
    try { await libraryRequest(`/books/${id}/order`, "PUT", { ids: next.map(item => item.id) }); setChapters(next); }
    catch (e) { setError(e instanceof Error ? e.message : "เรียงตอนไม่ได้"); }
    finally { setSaving(false); }
  }

  function checkDraftForChapter(targetId: number | null, serverTitle = "", serverContent = "") {
    try {
      const savedDraft = JSON.parse(localStorage.getItem(draftKey(targetId)) || "null") as LocalDraft | null;
      if (savedDraft && (savedDraft.title !== serverTitle || savedDraft.content !== serverContent)) {
        setRecoverableDraft(savedDraft);
      } else {
        setRecoverableDraft(null);
      }
    } catch {
      setRecoverableDraft(null);
    }
  }

  if (busy) return <div className="content-shell"><FeedbackPanel>กำลังเปิดต้นฉบับ…</FeedbackPanel></div>;
  if (error && !account) return <div className="content-shell"><FeedbackPanel variant="notice" role="alert" title="เปิดพื้นที่เขียนนิยายไม่สำเร็จ"><p>{error}</p></FeedbackPanel></div>;
  if (!account) return <div className="content-shell"><FeedbackPanel title="เข้าสู่ระบบเพื่อเขียนนิยาย"><ActionLink href={`/account?next=${encodeURIComponent(`/studio/${id}`)}`} className="hero-cta">เข้าสู่ระบบ</ActionLink></FeedbackPanel></div>;
  if (!isNew && (!book || !book.is_owner)) return <div className="content-shell"><FeedbackPanel title={error || "ไม่พบเรื่องที่แก้ไขได้"}><ActionLink href="/studio" className="hero-cta">กลับพื้นที่นักเขียน</ActionLink></FeedbackPanel></div>;

  const publicNovelHref = book ? `/novel/${book.id}/${slugify(book.title)}` : null;

  return (
    <div className="content-shell">
      <Link className="back-link" href="/studio">← กลับพื้นที่นักเขียน</Link>
      <SectionHeading
        className="studio-title"
        as="h1"
        eyebrow="จัดการผลงาน"
        title={isNew ? "สร้างนิยายใหม่" : book?.title}
        action={
          publicNovelHref && (
            <ActionLink tone="secondary" className="detail-contents-link" href={publicNovelHref}>
              <ExternalLink aria-hidden="true" /> ดูหน้านิยาย
            </ActionLink>
          )
        }
      />
      {notice && <p className="form-success" role="status"><Check aria-hidden="true" /> {notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <Card asChild className="writer-panel">
        <form onSubmit={saveBook}>
          <div className="writer-panel-heading">
            <h2>รายละเอียดเรื่อง</h2>
            <ActionButton type="submit" className="search-button" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "บันทึกเรื่อง"}
            </ActionButton>
          </div>
          <BookFields value={bookForm} onChange={setBookForm} defaultPenName={account.name} tone={(book?.id ?? 0) % 4} />
        </form>
      </Card>

      {!isNew && (
        <div className="chapter-editor-layout">
          <Card asChild className="writer-panel">
            <section>
              <div className="writer-panel-heading">
                <h2>สารบัญ · {chapters.length} ตอน</h2>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (chapterDirty && !window.confirm("มีข้อความที่ยังไม่ได้บันทึก ต้องการทิ้งแล้วเพิ่มตอนใหม่หรือไม่?")) return;
                    setChapter({ id: null, title: "", content: "", published: false });
                    setChapterDirty(false);
                    setNotice("");
                    checkDraftForChapter(null);
                  }}
                >
                  ＋ เพิ่มตอนใหม่
                </Button>
              </div>
              {chapters.length ? (
                <ol className="studio-chapters">
                  {chapters.map((item, index) => {
                    const active = chapter.id === item.id;
                    return (
                      <li key={item.id} className={active ? "is-active" : undefined}>
                        <Button
                          variant="ghost"
                          type="button"
                          className={`chapter-select${active ? " is-active" : ""}`}
                          aria-current={active ? "true" : undefined}
                          disabled={saving}
                          onClick={async () => {
                            if (chapter.id === item.id) return;
                            if (chapterDirty && !window.confirm("มีข้อความที่ยังไม่ได้บันทึก ต้องการทิ้งแล้วเปิดตอนอื่นหรือไม่?")) return;
                            setError("");
                            setNotice("");
                            try {
                              const data = await libraryRequest<{ title: string; content: string; published: boolean }>(`/chapters/${item.id}`);
                              setChapter({ id: item.id, ...data });
                              setChapterDirty(false);
                              checkDraftForChapter(item.id, data.title, data.content);
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "เปิดตอนไม่ได้");
                            }
                          }}
                        >
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{item.title}</strong>
                          <small className={item.published ? "status-published" : "status-draft"}>
                            {item.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                          </small>
                        </Button>
                        <div className="order-controls">
                          <Button variant="outline" size="icon" type="button" aria-label={`เลื่อน ${item.title} ขึ้น`} disabled={index === 0 || saving} onClick={() => moveChapter(index, -1)}>↑</Button>
                          <Button variant="outline" size="icon" type="button" aria-label={`เลื่อน ${item.title} ลง`} disabled={index === chapters.length - 1 || saving} onClick={() => moveChapter(index, 1)}>↓</Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="account-intro">ยังไม่มีตอน เริ่มเขียนตอนแรกทางด้านขวาได้เลย</p>
              )}
            </section>
          </Card>

          <Card asChild className="writer-panel chapter-form">
            <form onSubmit={saveChapter}>
              <div className="writer-panel-heading">
                <div>
                  <h2>{chapter.id ? "แก้ไขตอน" : "เขียนตอนใหม่"}</h2>
                  <span className="help-copy">
                    {chapter.content.length.toLocaleString("th-TH")} ตัวอักษร
                    {chapterDirty ? " · สำรองร่างในเบราว์เซอร์อัตโนมัติ" : ""}
                  </span>
                </div>
                <ActionButton type="submit" className="search-button" disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึกตอน"}
                </ActionButton>
              </div>

              {recoverableDraft && (
                <div className="draft-recovery-banner" role="status">
                  <div>
                    <strong>พบข้อความร่างที่สำรองไว้ในเบราว์เซอร์</strong>
                    <p className="help-copy">ต้องการกู้คืนข้อความที่เขียนค้างไว้ก่อนหน้านี้หรือไม่?</p>
                  </div>
                  <div className="draft-recovery-actions">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setChapter(curr => ({ ...curr, title: recoverableDraft.title, content: recoverableDraft.content, published: recoverableDraft.published }));
                        setChapterDirty(true);
                        setRecoverableDraft(null);
                      }}
                    >
                      กู้คืนข้อความร่าง
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        try { localStorage.removeItem(draftKey(chapter.id)); } catch { /* ignore */ }
                        setRecoverableDraft(null);
                      }}
                    >
                      ทิ้งร่างที่สำรอง
                    </Button>
                  </div>
                </div>
              )}

              <Label>
                ชื่อตอน
                <Input
                  required
                  maxLength={200}
                  value={chapter.title}
                  onChange={e => { setChapter({ ...chapter, title: e.target.value }); setChapterDirty(true); }}
                  placeholder="เช่น ตอนที่ 1 จุดเริ่มต้นของสายหมอก"
                />
              </Label>
              <Label>
                เนื้อหา
                <Textarea
                  required={!chapter.id || chapter.published}
                  rows={16}
                  maxLength={200000}
                  value={chapter.content}
                  onChange={e => { setChapter({ ...chapter, content: e.target.value }); setChapterDirty(true); }}
                  placeholder="เริ่มเขียนเรื่องราวของคุณ… เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่"
                />
              </Label>
              <Label className="publish-toggle">
                <Checkbox
                  checked={chapter.published}
                  onCheckedChange={checked => { setChapter({ ...chapter, published: checked === true }); setChapterDirty(true); }}
                />
                <span>เผยแพร่ตอนนี้ให้ผู้อ่านเห็น</span>
              </Label>
              <p className="help-copy">บันทึกฉบับร่างได้โดยไม่เผยแพร่ ผู้อ่านจะเห็นตอนเมื่อเลือกเผยแพร่และกดบันทึกตอน</p>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

