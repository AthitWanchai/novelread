import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coverUrl, getChapter, getNovel, slugify } from "@/lib/api/novels";
import { ReadingExperience } from "@/features/reader/reading-experience";

type Props = { params: Promise<{ id: string; slug: string; chapterId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, chapterId } = await params;
  const [novel, chapter] = await Promise.all([getNovel(id), getChapter(chapterId)]);
  if (!novel || !chapter || chapter.book_id !== novel.id) return { title: "ไม่พบตอนนิยาย" };
  const description = `${chapter.title} ตอนหนึ่งจากเรื่อง ${novel.title} โดย ${novel.pen_name}`;
  return {
    title: `${chapter.title} — ${novel.title}`,
    description,
    alternates: { canonical: `/novel/${novel.id}/${slugify(novel.title)}/chapter/${chapter.id}/${slugify(chapter.title)}` },
    openGraph: { title: `${chapter.title} — ${novel.title}`, description, type: "article", siteName: "Novelread", locale: "th_TH", images: novel.cover ? [coverUrl(novel.cover)] : undefined },
  };
}

export default async function ChapterPage({ params }: Props) {
  const { id, chapterId } = await params;
  const [novel, chapter] = await Promise.all([getNovel(id), getChapter(chapterId)]);
  if (!novel || !chapter || chapter.book_id !== novel.id) notFound();
  const chapters = novel.chapters ?? [];
  const index = chapters.findIndex(item => item.id === chapter.id);
  const previous = index > 0 ? chapters[index - 1] : undefined;
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : undefined;
  const chapterHref = (target: { id: number; title: string }) => `/novel/${novel.id}/${slugify(novel.title)}/chapter/${target.id}/${slugify(target.title)}`;
  return (
    <article className="reader-page">
      <div className="reader-top"><Link className="back-link" href={`/novel/${novel.id}/${slugify(novel.title)}`}>← {novel.title}</Link><span>ตอนที่ {index + 1} / {chapters.length}</span></div>
      <header className="reader-heading"><span className="section-kicker">{novel.title}</span><h1>{chapter.title}</h1><p>โดย {novel.pen_name}</p></header>
      <ReadingExperience bookId={novel.id} novelHref={`/novel/${novel.id}/${slugify(novel.title)}`} chapterId={chapter.id} content={chapter.content} published={chapter.published} chapterIndex={Math.max(0, index)} chapterCount={chapters.length} />
      <nav className="reader-pagination" aria-label="เปลี่ยนตอน">
        {previous ? <Link className="reader-nav-link" href={chapterHref(previous)}><span>← ตอนก่อนหน้า</span><strong>{previous.title}</strong></Link> : <span />}
        {next ? <Link className="reader-nav-link reader-next" href={chapterHref(next)}><span>ตอนถัดไป →</span><strong>{next.title}</strong></Link> : <Link className="reader-nav-link reader-next" href={`/novel/${novel.id}/${slugify(novel.title)}`}><span>อ่านจบแล้ว</span><strong>กลับไปสารบัญ ↗</strong></Link>}
      </nav>
    </article>
  );
}
