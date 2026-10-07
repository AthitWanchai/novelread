import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coverUrl, getNovel, slugify } from "@/lib/api/novels";
import { SectionHeading } from "@/components/ui/section-heading";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { ActionLink } from "@/components/ui/action-link";
import { CoverImage } from "@/components/novel/cover-image";

type Props = { params: Promise<{ id: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const novel = await getNovel(id);
  if (!novel) return { title: "ไม่พบนิยาย" };
  const description = novel.summary?.trim() || `อ่าน ${novel.title} ผลงานของ ${novel.pen_name} บน Novelread`;
  return {
    title: novel.title,
    description,
    alternates: { canonical: `/novel/${novel.id}/${slugify(novel.title)}` },
    openGraph: { title: novel.title, description, type: "article", siteName: "Novelread", locale: "th_TH", images: novel.cover ? [coverUrl(novel.cover)] : undefined },
  };
}

export default async function NovelPage({ params }: Props) {
  const { id } = await params;
  const novel = await getNovel(id);
  if (!novel) notFound();
  const chapters = novel.chapters ?? [];
  return (
    <div className="content-shell">
      <Link className="back-link" href="/">← กลับไปค้นพบนิยาย</Link>
      <article className="novel-detail">
        <div className="detail-cover">
          <CoverImage src={coverUrl(novel.cover)} alt={`ปกเรื่อง ${novel.title}`} title={novel.title} category={novel.category} tone={novel.id % 4} sizes="(max-width: 480px) 110px, (max-width: 740px) 145px, 220px" className="detail-placeholder" />
        </div>
        <div className="detail-copy">
          <span className="novel-category">{novel.category}</span>
          <h1>{novel.title}</h1>
          <p className="detail-author">โดย {novel.pen_name}</p>
          <div className="detail-badges"><span>{novel.status}</span><span>{novel.rating}</span><span>{chapters.length} ตอน</span></div>
          <p className="detail-summary">{novel.summary || "เรื่องราวกำลังรอให้คุณเปิดอ่าน"}</p>
          {chapters[0] && <ActionLink className="hero-cta detail-cta" href={`/novel/${novel.id}/${slugify(novel.title)}/chapter/${chapters[0].id}/${slugify(chapters[0].title)}`}>เริ่มอ่านตอนแรก <span aria-hidden="true">→</span></ActionLink>}
        </div>
      </article>
      <section className="chapter-section">
        <SectionHeading eyebrow="THE STORY SO FAR" title="สารบัญ" action={<span className="result-count">{chapters.length} ตอน</span>} />
        {chapters.length ? <ol className="chapter-list">{chapters.map((chapter, index) => <li key={chapter.id}><Link href={`/novel/${novel.id}/${slugify(novel.title)}/chapter/${chapter.id}/${slugify(chapter.title)}`}><span className="chapter-number">{String(index + 1).padStart(2, "0")}</span><span className="chapter-title">{chapter.title}</span><span className="chapter-arrow" aria-hidden="true">↗</span></Link></li>)}</ol> : <FeedbackPanel title="ยังไม่มีตอนที่เผยแพร่" />}
      </section>
    </div>
  );
}
