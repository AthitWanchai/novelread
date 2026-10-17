import Link from "next/link";
import { PenLine, Sparkles } from "lucide-react";
import { listNovels, type Novel } from "@/lib/api/novels";
import { NovelCard } from "@/components/novel/novel-card";
import { NovelShelf } from "@/components/novel/novel-shelf";
import { SectionHeading } from "@/components/ui/section-heading";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { Entrance } from "@/components/ui/entrance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/search-form";
import { SpotlightCarousel } from "@/components/novel/spotlight-carousel";
import { CategoryBrowser } from "@/components/novel/category-browser";
import { ContinueReading } from "@/components/novel/continue-reading";

const categories = ["แฟนตาซี", "รักโรแมนติก", "วาย", "สืบสวน", "ผจญภัย", "ดราม่า", "อื่น ๆ"];

export const dynamic = "force-dynamic";

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

  const spotlight = novels.slice(0, 3);
  const latest = novels.slice(0, 8);
  const completed = novels.filter(novel => novel.status === "จบแล้ว").slice(0, 4);

  return (
    <div className="page-shell home-page">
      {!hasFilters && connected && <SpotlightCarousel novels={spotlight} />}
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
            {completed.length > 0 && (
              <section className="completed-section">
                <SectionHeading
                  eyebrow="อ่านได้ครบทุกตอน"
                  title="จบแล้ว อ่านได้ยาว ๆ"
                  action={
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/?status=%E0%B8%88%E0%B8%9A%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7">ดูเรื่องจบแล้วทั้งหมด <span aria-hidden="true">→</span></Link>
                    </Button>
                  }
                />
                <div className="completed-grid">{completed.map(novel => <NovelCard key={novel.id} novel={novel} featured />)}</div>
              </section>
            )}
            <section className="creator-cta-banner" aria-label="เชิญชวนนักเขียน">
              <div className="creator-cta-copy">
                <span className="section-kicker"><Sparkles aria-hidden="true" /> พื้นที่สำหรับนักสร้างสรรค์</span>
                <h2>มีเรื่องราวในจินตนาการที่อยากเล่าให้โลกฟังใช่ไหม?</h2>
                <p>เปิดสตูดิโอเขียนนิยายของคุณบน Novelread จัดการสารบัญ บันทึกร่างอัตโนมัติ และเผยแพร่ให้นักอ่านติดตามได้ทันที</p>
              </div>
              <Button asChild className="creator-cta-btn">
                <Link href="/studio"><PenLine aria-hidden="true" /> เริ่มเขียนนิยายเรื่องแรก</Link>
              </Button>
            </section>
          </>
        )}
      </Entrance>
    </div>
  );
}

