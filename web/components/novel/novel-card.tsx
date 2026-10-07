import Link from "next/link";
import { coverUrl, slugify, type Novel } from "@/lib/api/novels";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CoverImage } from "@/components/novel/cover-image";

export function NovelCard({ novel, featured = false }: { novel: Novel; featured?: boolean }) {
  const href = `/novel/${novel.id}/${slugify(novel.title)}`;
  return (
    <article className={`novel-card${featured ? " novel-card-featured" : ""}`}>
      <Card asChild className="novel-card-link"><Link href={href}>
        <div className="cover-frame">
          <CoverImage src={coverUrl(novel.cover)} alt={`ปกเรื่อง ${novel.title}`} title={novel.title} category={novel.category} tone={novel.id % 4} sizes={featured ? "(max-width: 740px) 130px, 180px" : "(max-width: 480px) 44vw, (max-width: 1000px) 22vw, 18vw"} />
        </div>
        <div className="novel-card-info">
          <Badge variant="secondary" className="novel-category">{novel.category}</Badge>
          <h3>{novel.title}</h3>
          <p>โดย {novel.pen_name}</p>
          {featured && novel.summary && <p className="novel-card-summary">{novel.summary}</p>}
          <div className="novel-meta"><span>{novel.chapter_count ?? novel.chapters?.length ?? 0} ตอน</span><Badge variant="outline" className="novel-status">{novel.status}</Badge></div>
          {featured && <span className="featured-read-link">เริ่มอ่าน <span aria-hidden="true">↗</span></span>}
        </div>
      </Link></Card>
    </article>
  );
}
