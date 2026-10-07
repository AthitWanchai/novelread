"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { NovelCard } from "@/components/novel/novel-card";
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
import { getNovel, type ChapterSummary, type Novel } from "@/lib/api/novels";

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
  if (!account) return <div className="content-shell"><FeedbackPanel title="เข้าสู่ระบบเพื่อเริ่มเขียนนิยาย"><p>ผลงานและฉบับร่างจะบันทึกไว้ในบัญชีของคุณ</p><ActionLink href="/account" className="hero-cta">เข้าสู่ระบบ <span>→</span></ActionLink></FeedbackPanel></div>;

  return <div className="content-shell">
    <SectionHeading as="h1" eyebrow="YOUR WRITING DESK" title="พื้นที่นักเขียน" action={<ActionButton className="search-button new-story-button" onClick={() => { setCreating(!creating); setError(""); }}>＋ สร้างเรื่องใหม่</ActionButton>} />
    <p className="studio-intro">จัดการนิยาย เขียนตอนใหม่ และเผยแพร่เมื่อพร้อม</p>
    {creating && <Card asChild className="writer-panel"><form onSubmit={create}><div className="writer-panel-heading"><h2>เริ่มเรื่องใหม่</h2><Button variant="ghost" type="button" className="text-button" onClick={() => setCreating(false)}>ปิด</Button></div>
      <BookFields value={form} onChange={setForm} defaultPenName={account.name} />
      {error && <p className="form-error" role="alert">{error}</p>}<ActionButton type="submit" className="search-button" disabled={busy}>สร้างนิยาย <span>→</span></ActionButton>
    </form></Card>}
    {error && !creating && <p className="form-error" role="alert">{error}</p>}
    {books.length ? <div className="novel-grid writer-grid">{books.map(book => <article className="writer-item" key={book.id}><NovelCard novel={book} /><Link className="writer-edit-link" href={`/studio/${book.id}`}>จัดการเรื่องและตอน ↗</Link></article>)}</div> : !creating && <FeedbackPanel icon="✎" title="เรื่องแรกของคุณเริ่มตรงนี้"><p>ตั้งชื่อเรื่อง เพิ่มคำโปรย แล้วเขียนตอนแรกได้เลย</p><ActionButton className="hero-cta" onClick={() => setCreating(true)}>สร้างนิยาย <span>→</span></ActionButton></FeedbackPanel>}
  </div>;
}

function BookFields({ value, onChange, defaultPenName }: { value: BookForm; onChange: (book: BookForm) => void; defaultPenName?: string }) {
  const change = (key: keyof BookForm, fieldValue: string) => onChange({ ...value, [key]: fieldValue });
  return <div className="writer-fields">
    <Label>ชื่อเรื่อง<Input required maxLength={200} value={value.title} onChange={e => change("title", e.target.value)} /></Label>
    <Label>นามปากกา<Input required maxLength={80} value={value.pen_name || defaultPenName || ""} onChange={e => change("pen_name", e.target.value)} /></Label>
    <Label className="writer-wide">คำโปรย<Textarea rows={4} maxLength={10000} value={value.summary} onChange={e => change("summary", e.target.value)} /></Label>
    <Label>หมวด<Select value={value.category} onValueChange={next => change("category", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
    <Label>สถานะ<Select value={value.status} onValueChange={next => change("status", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="กำลังเขียน">กำลังเขียน</SelectItem><SelectItem value="จบแล้ว">จบแล้ว</SelectItem></SelectContent></Select></Label>
    <Label>เรตเนื้อหา<Select value={value.rating} onValueChange={next => change("rating", next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ทั่วไป">ทั่วไป</SelectItem><SelectItem value="18+">18+</SelectItem></SelectContent></Select></Label>
    <Label>แท็ก<Input maxLength={300} value={value.tags} onChange={e => change("tags", e.target.value)} placeholder="คั่นแต่ละแท็กด้วยเครื่องหมายจุลภาค" /></Label>
    <Label className="writer-wide">ลิงก์ภาพปก<Input type="url" maxLength={2000} value={value.cover} onChange={e => change("cover", e.target.value)} placeholder="https://… (ไม่บังคับ)" /></Label>
  </div>;
}

export function WriterEditor({ id }: { id: string }) {
  const router = useRouter();
  const isNew = id === "new";
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [book, setBook] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [bookForm, setBookForm] = useState<BookForm>(blankBook);
  const [chapter, setChapter] = useState<{ id: number | null; title: string; content: string; published: boolean }>({ id: null, title: "", content: "", published: false });
  const [chapterDirty, setChapterDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      }
    }).catch(e => setError(e.message)).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id, isNew]);

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (isNew) {
        const created = await libraryRequest<{ id: number }>("/books", "POST", { ...bookForm, pen_name: bookForm.pen_name.trim() || account?.name || "" });
        router.replace(`/studio/${created.id}`); router.refresh();
      } else {
        const values = { ...bookForm, pen_name: bookForm.pen_name.trim() || account?.name || "" };
        await libraryRequest(`/books/${id}`, "PUT", values);
        setBook(current => current ? { ...current, ...values } : current);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกเรื่องไม่ได้"); }
    finally { setSaving(false); }
  }

  async function saveChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const route = chapter.id ? `/books/${id}/chapters/${chapter.id}` : `/books/${id}/chapters`;
      const result = await libraryRequest<{ id: number }>(route, chapter.id ? "PUT" : "POST", { title: chapter.title, content: chapter.content, published: chapter.published });
      const updated = await libraryRequest<Novel>(`/books/${id}`);
      setBook(updated); setChapters(updated.chapters ?? []);
      const saved = (updated.chapters ?? []).find(item => item.id === result.id);
      setChapter(saved ? { id: saved.id, title: saved.title, content: chapter.content, published: saved.published } : { id: null, title: "", content: "", published: false });
      setChapterDirty(false);
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกตอนไม่ได้"); }
    finally { setSaving(false); }
  }

  async function moveChapter(index: number, direction: -1 | 1) {
    const next = [...chapters]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSaving(true); setError("");
    try { await libraryRequest(`/books/${id}/order`, "PUT", { ids: next.map(item => item.id) }); setChapters(next); }
    catch (e) { setError(e instanceof Error ? e.message : "เรียงตอนไม่ได้"); }
    finally { setSaving(false); }
  }

  if (busy) return <div className="content-shell"><FeedbackPanel>กำลังเปิดต้นฉบับ…</FeedbackPanel></div>;
  if (error && !account) return <div className="content-shell"><FeedbackPanel variant="notice" role="alert" title="เปิดพื้นที่เขียนนิยายไม่สำเร็จ"><p>{error}</p></FeedbackPanel></div>;
  if (!account) return <div className="content-shell"><FeedbackPanel title="เข้าสู่ระบบเพื่อเขียนนิยาย"><ActionLink href="/account" className="hero-cta">เข้าสู่ระบบ <span>→</span></ActionLink></FeedbackPanel></div>;
  if (!isNew && (!book || !book.is_owner)) return <div className="content-shell"><FeedbackPanel title={error || "ไม่พบเรื่องที่แก้ไขได้"}><ActionLink href="/studio" className="hero-cta">กลับพื้นที่นักเขียน <span>→</span></ActionLink></FeedbackPanel></div>;

  return <div className="content-shell"><Link className="back-link" href="/studio">← กลับพื้นที่นักเขียน</Link>
    <SectionHeading className="studio-title" as="h1" eyebrow="WRITER STUDIO" title={isNew ? "สร้างนิยายใหม่" : book?.title} />
    <Card asChild className="writer-panel"><form onSubmit={saveBook}><div className="writer-panel-heading"><h2>รายละเอียดเรื่อง</h2><ActionButton type="submit" className="search-button" disabled={saving}>บันทึกเรื่อง</ActionButton></div><BookFields value={bookForm} onChange={setBookForm} defaultPenName={account.name} />{error && <p className="form-error" role="alert">{error}</p>}</form></Card>
    {!isNew && <div className="chapter-editor-layout"><Card asChild className="writer-panel"><section><div className="writer-panel-heading"><h2>สารบัญ · {chapters.length} ตอน</h2><Button variant="ghost" type="button" className="plain-link" disabled={saving} onClick={() => { if (chapterDirty && !window.confirm("มีข้อความที่ยังไม่ได้บันทึก ต้องการทิ้งแล้วเพิ่มตอนใหม่หรือไม่?")) return; setChapter({ id: null, title: "", content: "", published: false }); setChapterDirty(false); }}>＋ เพิ่มตอน</Button></div>
      {chapters.length ? <ol className="studio-chapters">{chapters.map((item, index) => <li key={item.id}><Button variant="ghost" type="button" className="chapter-select" disabled={saving} onClick={async () => { if (chapter.id === item.id) return; if (chapterDirty && !window.confirm("มีข้อความที่ยังไม่ได้บันทึก ต้องการทิ้งแล้วเปิดตอนอื่นหรือไม่?")) return; setError(""); try { const data = await libraryRequest<{ title: string; content: string; published: boolean }>(`/chapters/${item.id}`); setChapter({ id: item.id, ...data }); setChapterDirty(false); } catch (e) { setError(e instanceof Error ? e.message : "เปิดตอนไม่ได้"); } }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><small>{item.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</small></Button><div className="order-controls"><Button variant="outline" size="icon" type="button" aria-label={`เลื่อน ${item.title} ขึ้น`} disabled={index === 0 || saving} onClick={() => moveChapter(index, -1)}>↑</Button><Button variant="outline" size="icon" type="button" aria-label={`เลื่อน ${item.title} ลง`} disabled={index === chapters.length - 1 || saving} onClick={() => moveChapter(index, 1)}>↓</Button></div></li>)}</ol> : <p className="account-intro">ยังไม่มีตอน เริ่มเขียนตอนแรกได้เลย</p>}
    </section></Card>
    <Card asChild className="writer-panel chapter-form"><form onSubmit={saveChapter}><div className="writer-panel-heading"><h2>{chapter.id ? "แก้ไขตอน" : "เขียนตอนใหม่"}</h2><ActionButton type="submit" className="search-button" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกตอน"}</ActionButton></div><Label>ชื่อตอน<Input required maxLength={200} value={chapter.title} onChange={e => { setChapter({ ...chapter, title: e.target.value }); setChapterDirty(true); }} /></Label><Label>เนื้อหา<Textarea required={!chapter.id || chapter.published} rows={16} maxLength={200000} value={chapter.content} onChange={e => { setChapter({ ...chapter, content: e.target.value }); setChapterDirty(true); }} placeholder="เริ่มเขียนเรื่องราวของคุณ…" /></Label><Label className="publish-toggle"><Checkbox checked={chapter.published} onCheckedChange={checked => { setChapter({ ...chapter, published: checked === true }); setChapterDirty(true); }} /> <span>เผยแพร่ตอนนี้</span></Label><p className="help-copy">บันทึกฉบับร่างได้โดยไม่เผยแพร่ ผู้อ่านจะเห็นตอนเมื่อเลือกเผยแพร่</p></form></Card></div>}
    {error && isNew && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
