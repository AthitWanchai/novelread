"use client";
import { useState } from "react";
import Link from "next/link";
import { NovelCard } from "./novel-card";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Novel } from "@/lib/api/novels";

export function CategoryBrowser({ novels }: { novels: Novel[] }) {
  const categories = [...new Set(novels.map(n => n.category))];
  const [selected, setSelected] = useState(categories[0] || "");
  if (!categories.length) return null;
  const activeCategory = categories.includes(selected) ? selected : categories[0];
  const books = novels.filter(n => n.category === activeCategory);
  const [featured, ...more] = books;

  return (
    <section id="categories" className="category-browser">
      <SectionHeading
        eyebrow="เลือกตามแนวเรื่อง"
        title="สำรวจนิยายตามหมวดหมู่"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/?category=${encodeURIComponent(activeCategory)}`}>
              ดูหมวด {activeCategory} ทั้งหมด <span aria-hidden="true">→</span>
            </Link>
          </Button>
        }
      />
      <div className="category-tabs-bar" role="tablist" aria-label="หมวดหมู่นิยาย">
        {categories.map(cat => {
          const count = novels.filter(n => n.category === cat).length;
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`category-tab-pill${isActive ? " is-active" : ""}`}
              onClick={() => setSelected(cat)}
            >
              <span>{cat}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>
      {featured && (
        <div className="category-picks">
          <NovelCard novel={featured} featured />
          {more.length > 0 && (
            <div className="category-supporting-grid">
              {more.slice(0, 3).map(novel => (
                <NovelCard key={novel.id} novel={novel} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

