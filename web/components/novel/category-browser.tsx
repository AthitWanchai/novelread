"use client";
import { useState } from "react";
import Link from "next/link";
import { NovelCard } from "./novel-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Novel } from "@/lib/api/novels";
export function CategoryBrowser({ novels }: { novels: Novel[] }) {
  const categories = [...new Set(novels.map(n => n.category))];
  const [selected, setSelected] = useState(categories[0] || "");
  if (!categories.length) return null;
  const books = novels.filter(n => n.category === selected);
  const [featured, ...more] = books;
  return <section id="categories" className="category-browser">
    <SectionHeading eyebrow="EXPLORE BY GENRE" title="เลือกอ่านตามหมวด" action={<><Select value={selected} onValueChange={setSelected}><SelectTrigger className="compact-select" aria-label="เลือกหมวดนิยาย"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem value={c} key={c}>{c}</SelectItem>)}</SelectContent></Select><Button asChild variant="ghost" size="sm"><Link href={`/?category=${encodeURIComponent(selected)}`}>ดูทั้งหมด <span aria-hidden="true">→</span></Link></Button></>} />
    {featured && <div className="category-picks"><NovelCard novel={featured} featured /><div className="category-supporting-grid">{more.slice(0, 3).map(novel => <NovelCard key={novel.id} novel={novel} />)}</div></div>}
  </section>;
}
