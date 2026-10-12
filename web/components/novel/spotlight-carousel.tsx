import Image from "next/image";
import Link from "next/link";
import { Carousel } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { slugify, type Novel } from "@/lib/api/novels";

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
          return (
            <article className="spotlight-slide carousel-slide" key={novel.id}>
              <Image className="spotlight-image" src={artwork} alt="" fill priority={index === 0} sizes="(max-width: 720px) 100vw, 1200px" />
              <div className="spotlight-copy">
                <span className="section-kicker">{novel.category} · {novel.status}</span>
                <h2>{novel.title}</h2>
                {novel.summary && <p className="spotlight-summary">{novel.summary}</p>}
                <Button asChild>
                  <Link href={href}>อ่านเรื่องนี้ <span aria-hidden="true">→</span></Link>
                </Button>
              </div>
            </article>
          );
        })}
      </Carousel>
    </section>
  );
}
