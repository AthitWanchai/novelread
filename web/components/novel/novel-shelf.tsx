import { NovelCard } from "./novel-card";
import { Carousel } from "@/components/ui/carousel";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import type { Novel } from "@/lib/api/novels";

export function NovelShelf({ title, eyebrow = "คัดสรรเรื่องน่าอ่าน", novels }: { title: string; eyebrow?: string; novels: Novel[] }) {
  if (!novels.length) return null;
  return (
    <section className="home-shelf">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        action={<Badge variant="outline" className="result-count">{novels.length} เรื่อง</Badge>}
      />
      <Carousel label={title}>
        {novels.map(novel => (
          <div className="carousel-slide" key={novel.id}>
            <NovelCard novel={novel} />
          </div>
        ))}
      </Carousel>
    </section>
  );
}

