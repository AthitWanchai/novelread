import { NovelCard } from "./novel-card";
import { Carousel } from "@/components/ui/carousel";
import type { Novel } from "@/lib/api/novels";
export function NovelShelf({ title, novels }: { title: string; novels: Novel[] }) {
  if (!novels.length) return null;
  return <section className="home-shelf"><div className="section-heading"><h2>{title}</h2><span className="muted">{novels.length} เรื่อง</span></div><Carousel label={title}>{novels.map(novel => <div className="carousel-slide" key={novel.id}><NovelCard novel={novel} /></div>)}</Carousel></section>;
}
