import { listNovels, type Novel } from "@/lib/api/novels";
import { NovelCard } from "@/components/novel/novel-card";
import { NovelShelf } from "@/components/novel/novel-shelf";
import { SectionHeading } from "@/components/ui/section-heading";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { Entrance } from "@/components/ui/entrance";
import { Badge } from "@/components/ui/badge";
import { SearchForm } from "@/components/search-form";
import { SpotlightCarousel } from "@/components/novel/spotlight-carousel";
import { CategoryBrowser } from "@/components/novel/category-browser";
import { ContinueReading } from "@/components/novel/continue-reading";

const categories = ["แฟนตาซี", "รักโรแมนติก", "วาย", "สืบสวน", "ผจญภัย", "ดราม่า", "อื่น ๆ"];

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

  const latest = novels;
  const completed = novels.filter(novel => novel.status === "จบแล้ว");

  return (
    <div className="page-shell home-page">
      {!hasFilters && connected && <SpotlightCarousel novels={novels} />}
      <Entrance as="section" className="discovery-toolbar" id="discover">
        {hasFilters && <h1>ค้นหานิยาย</h1>}
        <SearchForm initialQuery={filters.q} category={filters.category ?? queryCategory} status={filters.status} categories={categories} />
      </Entrance>

      <Entrance as="section" className="discover-section">
        {!connected ? (
          <FeedbackPanel variant="notice" title="ยังเชื่อมต่อคลังนิยายไม่ได้"><p>ตรวจสอบว่า API ของ Novelread ทำงานอยู่ แล้วลองรีเฟรชหน้านี้อีกครั้ง</p></FeedbackPanel>
        ) : novels.length === 0 ? (
          <FeedbackPanel title={hasFilters ? "ยังไม่พบเรื่องที่ตรงกับการค้นหา" : "ชั้นหนังสือกำลังรอเรื่องแรก"}><p>{hasFilters ? "ลองเปลี่ยนคำค้นหรือเลือกหมวดอื่นดูนะ" : "เมื่อนักเขียนเผยแพร่นิยาย เรื่องใหม่จะมาปรากฏตรงนี้"}</p></FeedbackPanel>
        ) : hasFilters ? (
          <>
            <SectionHeading eyebrow="ผลลัพธ์จากคลังนิยาย" title="ผลการค้นหา" action={<Badge variant="outline" className="result-count">{novels.length} เรื่อง</Badge>} />
            <div className="novel-grid search-results-grid">{novels.map(novel => <NovelCard key={novel.id} novel={novel} />)}</div>
          </>
        ) : (
          <>
            <ContinueReading />
            {latest.length > 0 && <NovelShelf title="อัปเดตล่าสุด" novels={latest} />}
            <CategoryBrowser novels={novels} />
            {completed.length > 0 && <section className="completed-section"><SectionHeading eyebrow="อ่านได้ครบทุกตอน" title="จบแล้ว อ่านได้ยาว ๆ" /><div className="completed-grid">{completed.slice(0, 4).map(novel => <NovelCard key={novel.id} novel={novel} featured />)}</div></section>}
          </>
        )}
      </Entrance>
    </div>
  );
}
