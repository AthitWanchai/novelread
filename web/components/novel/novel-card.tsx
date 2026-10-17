import Link from "next/link";
import { coverUrl, slugify, type Novel } from "@/lib/api/novels";
import { AuthorLink } from "@/components/novel/author-link";
import { CoverImage } from "@/components/novel/cover-image";

export function NovelCard({ novel, featured = false }: { novel: Novel; featured?: boolean }) {
  const href = `/novel/${novel.id}/${slugify(novel.title)}`;
  const chapterCount = novel.chapter_count ?? novel.chapters?.length ?? 0;
  const isComplete = novel.status === "จบแล้ว";
  return (
    <article className={`novel-card${featured ? " novel-card-featured" : ""}`}>
      <Link className="novel-card-link" href={href} aria-label={`อ่าน ${novel.title}`}>
        <div className="cover-frame">
          <CoverImage
            src={coverUrl(novel.cover)}
            alt={`ปกเรื่อง ${novel.title}`}
            title={novel.title}
            category={novel.category}
            tone={novel.id % 6}
            sizes={featured ? "(max-width: 740px) 130px, 180px" : "(max-width: 480px) 44vw, (max-width: 1000px) 22vw, 18vw"}
          />
          <span className={`cover-floating-status${isComplete ? " is-complete" : ""}`}>{novel.status}</span>
        </div>
      </Link>
      <div className="novel-card-info">
        <span className="novel-category">{novel.category}</span>
        <h3><Link href={href}>{novel.title}</Link></h3>
        <p className="novel-author-line">โดย <AuthorLink id={novel.owner} name={novel.pen_name} /></p>
        {featured && novel.summary && <p className="novel-card-summary">{novel.summary}</p>}
        <div className="novel-meta">
          <span className="novel-chapter-pill">{chapterCount} ตอน</span>
          <span className={`novel-status${isComplete ? " is-complete" : ""}`}>{novel.status}</span>
        </div>
        {featured && (
          <Link href={href} className="featured-read-link">
            เริ่มอ่านเรื่องนี้ <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </article>
  );
}

