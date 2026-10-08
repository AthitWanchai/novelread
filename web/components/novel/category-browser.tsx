"use client";
import { useState } from "react";
import { NovelShelf } from "./novel-shelf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Novel } from "@/lib/api/novels";
export function CategoryBrowser({ novels }: { novels: Novel[] }) {
  const categories = [...new Set(novels.map(n => n.category))];
  const [selected, setSelected] = useState(categories[0] || "");
  if (!categories.length) return null;
  return <section id="categories" className="category-browser"><div className="section-heading"><h2>เลือกอ่านตามหมวด</h2><Select value={selected} onValueChange={setSelected}><SelectTrigger className="compact-select" aria-label="เลือกหมวดนิยาย"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem value={c} key={c}>{c}</SelectItem>)}</SelectContent></Select></div><NovelShelf key={selected} title={selected} novels={novels.filter(n => n.category === selected)} /></section>;
}
