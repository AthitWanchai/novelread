import Image from "next/image";
import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";
import { Carousel } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/novel/cover-image";
import { coverUrl, slugify, type Novel } from "@/lib/api/novels";

const artworkByCategory: Record<string, string> = {
  "แฟนตาซี": "/demo-banners/fantasy-city.png",
  "สืบสวน": "/demo-banners/mystery-lane.png",
  "ผจญภัย": "/demo-banners/adventure-bridge.png",
};
const availableArtwork = Object.values(artworkByCategory);

export function SpotlightCarousel({ novels }: { novels: Novel[] }) {
  if (!novels.length) return null;
  const unusedArtwork = new Set(availableArtwork);
  const slides = novels.slice(0, availableArtwork.length).flatMap(novel => {
    const preferred = artworkByCategory[novel.category];
    const artwork = (preferred && unusedArtwork.has(preferred) ? preferred : [...unusedArtwork][0]);
    if (!artwork) return [];
    unusedArtwork.delete(artwork);
    return [{ novel, artwork }];
  });

  return (
    <section className="home-spotlight" aria-label="เรื่องแนะนำ">
      <h1 className="sr-only">Novelread ค้นพบเรื่องโปรดเล่มถัดไป</h1>
      <Carousel label="เรื่องแนะนำ" hero>
        {slides.map(({ novel, artwork }, index) => {
          const href = `/novel/${novel.id}/${slugify(novel.title)}`;
          const chapterCount = novel.chapter_count ?? novel.chapters?.length ?? 0;
          return (
            <article className="spotlight-slide carousel-slide" key={novel.id}>
              <Image className="spotlight-image" src={artwork} alt="" fill priority={index === 0} sizes="(max-width: 720px) 100vw, 1240px" />
              <div className="spotlight-copy">
                <div className="spotlight-pills">
                  <span className="spotlight-featured-pill"><Sparkles aria-hidden="true" /> เรื่องแนะนำ</span>
                  <span className="spotlight-meta-pill">{novel.category}</span>
                  <span className="spotlight-meta-pill">{novel.status}</span>
                  {chapterCount > 0 && <span className="spotlight-meta-pill">{chapterCount} ตอน</span>}
                </div>
                <h2>{novel.title}</h2>
                <p className="spotlight-author">สร้างสรรค์โดย <strong>{novel.pen_name}</strong></p>
                {novel.summary && <p className="spotlight-summary">{novel.summary}</p>}
                <div className="spotlight-actions">
                  <Button asChild className="spotlight-primary-btn">
                    <Link href={href}><BookOpen aria-hidden="true" /> อ่านเรื่องนี้ <span aria-hidden="true">→</span></Link>
                  </Button>
                  <Button asChild variant="outline" className="spotlight-secondary-btn">
                    <Link href={`${href}#chapters`}>ดูสารบัญ</Link>
                  </Button>
                </div>
              </div>
              <Link href={href} className="spotlight-cover-showcase" aria-hidden="true" tabIndex={-1}>
                <div className="spotlight-cover">
                  <CoverImage
                    src={coverUrl(novel.cover)}
                    alt=""
                    title={novel.title}
                    category={novel.category}
                    tone={novel.id % 6}
                    sizes="220px"
                  />
                </div>
              </Link>
            </article>
          );
        })}
      </Carousel>
    </section>
  );
}

