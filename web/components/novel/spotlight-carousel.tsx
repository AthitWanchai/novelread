import Link from "next/link";
import { Carousel } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { CoverImage } from "./cover-image";
import { AuthorLink } from "./author-link";
import { coverUrl, slugify, type Novel } from "@/lib/api/novels";

export function SpotlightCarousel({ novels }: { novels: Novel[] }) {
  if (!novels.length) return null;
  return <section className="home-spotlight" aria-label="เปิดเรื่องอ่าน"><h1 className="sr-only">Novelread ค้นพบเรื่องโปรดเล่มถัดไป</h1><Carousel label="เปิดเรื่องอ่าน" hero>{novels.slice(0, 5).map(novel => <article className="spotlight-slide carousel-slide" key={novel.id}><div className="spotlight-copy"><span className="section-kicker">{novel.category} · {novel.status}</span><h2>{novel.title}</h2><p className="muted">โดย <AuthorLink id={novel.owner} name={novel.pen_name} /></p><p className="spotlight-summary">{novel.summary || "เปิดอ่านเรื่องราวและติดตามตอนใหม่จากนักเขียน"}</p><Button asChild><Link href={`/novel/${novel.id}/${slugify(novel.title)}`}>อ่านเรื่องนี้</Link></Button></div><Link className="spotlight-cover" href={`/novel/${novel.id}/${slugify(novel.title)}`} aria-label={`อ่าน ${novel.title}`}><CoverImage src={coverUrl(novel.cover)} alt={`ปก ${novel.title}`} title={novel.title} category={novel.category} tone={novel.id % 4} sizes="(max-width: 640px) 160px, 280px" /></Link></article>)}</Carousel></section>;
}
