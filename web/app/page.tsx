import { listNovels, slugify, type Novel } from "@/lib/api/novels";
import { NovelCard } from "@/components/novel/novel-card";
import { SpotlightCarousel } from "@/components/novel/spotlight-carousel";
import { SectionHeading } from "@/components/ui/section-heading";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { Entrance } from "@/components/ui/entrance";
import { Badge } from "@/components/ui/badge";
import { SearchForm } from "@/components/search-form";

const categories = ["แฟนตาซี", "รักโรแมนติก", "วาย", "สืบสวน", "ผจญภัย", "ดราม่า", "อื่น ๆ"];

function NovelShelf({ title, novels }: { title: string; novels: Novel[] }) {
  const headingId = `shelf-${slugify(title)}`;
  return (
    <section className="home-shelf" aria-labelledby={headingId}>
      <div className="home-shelf-heading"><div><span className="section-kicker">อ่านต่อได้เลย</span><h2 id={headingId}>{title}</h2></div><span>{novels.length} เรื่อง</span></div>
      <div className="novel-grid" role="region" aria-labelledby={headingId} tabIndex={0}>
        {novels.map(novel => <NovelCard key={novel.id} novel={novel} />)}
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string }> }) {
  const filters = await searchParams;
  const queryCategory = !filters.category && filters.q ? categories.find(category => category === filters.q) : undefined;
  const resultFilters = queryCategory
    ? { ...filters, q: undefined, category: queryCategory }
    : filters;
  const hasFilters = Boolean(filters.q || filters.category || filters.status);
  let novels: Novel[] = [];
  let connected = true;
  try {
    novels = await listNovels(resultFilters);
  } catch {
    connected = false;
  }

  const spotlight = !hasFilters ? novels.slice(0, 3) : [];
  const latest = hasFilters ? novels : novels.slice(3);
  const categoryShelves = !hasFilters
    ? categories.map(category => ({ category, novels: novels.filter(novel => novel.category === category) })).filter(shelf => shelf.novels.length >= 2)
    : [];

  return (
    <div className="page-shell home-page">
      {!hasFilters && spotlight.length > 0 && <SpotlightCarousel novels={spotlight} />}

      <Entrance as="section" className="discovery-toolbar" id="discover" delay={0.04}>
        <div className="toolbar-copy"><span className="hero-kicker"><span className="kicker-dot" /> คลังนิยาย Novelread</span><h2>{hasFilters ? "ค้นหานิยาย" : "ค้นหาเรื่องที่ใช่"}</h2><p>ค้นหาจากชื่อเรื่อง นักเขียน หมวดหมู่ หรือสถานะ</p></div>
        <SearchForm initialQuery={filters.q} category={filters.category ?? queryCategory} status={filters.status} categories={categories} />
      </Entrance>

      <Entrance as="section" className="discover-section" delay={0.08}>
        {!connected ? (
          <FeedbackPanel variant="notice" title="ยังเชื่อมต่อคลังนิยายไม่ได้" icon="↗"><p>ตรวจสอบว่า API ของ Novelread ทำงานอยู่ แล้วลองรีเฟรชหน้านี้อีกครั้ง</p></FeedbackPanel>
        ) : novels.length === 0 ? (
          <FeedbackPanel icon="✦" title={hasFilters ? "ยังไม่พบเรื่องที่ตรงกับการค้นหา" : "ชั้นหนังสือกำลังรอเรื่องแรก"}><p>{hasFilters ? "ลองเปลี่ยนคำค้นหรือเลือกหมวดอื่นดูนะ" : "เมื่อนักเขียนเผยแพร่นิยาย เรื่องใหม่จะมาปรากฏตรงนี้"}</p></FeedbackPanel>
        ) : hasFilters ? (
          <>
            <SectionHeading eyebrow="YOUR SEARCH RESULTS" title="ผลการค้นหา" action={<Badge variant="outline" className="result-count">{novels.length} เรื่อง</Badge>} />
            <div className="novel-grid search-results-grid">{novels.map(novel => <NovelCard key={novel.id} novel={novel} />)}</div>
          </>
        ) : (
          <>
            {latest.length > 0 && <NovelShelf title="นิยายอัปเดตล่าสุด" novels={latest} />}
            {categoryShelves.map(shelf => <NovelShelf key={shelf.category} title={shelf.category} novels={shelf.novels} />)}
          </>
        )}
      </Entrance>
    </div>
  );
}
