"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SearchFiltersProps = {
  category?: string;
  status?: string;
  categories: string[];
  onChange: (filters: { category?: string; status?: string }) => void;
};

export function SearchFilters({ category, status, categories, onChange }: SearchFiltersProps) {
  return (
    <div className="search-panel search-panel-filters">
      <div className="select-wrap">
        <Select name="status" defaultValue={status || "all"} onValueChange={value => onChange({ category, status: value === "all" ? undefined : value })}>
          <SelectTrigger aria-label="สถานะนิยาย"><SelectValue placeholder="ทุกสถานะ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="กำลังเขียน">กำลังเขียน</SelectItem>
            <SelectItem value="จบแล้ว">จบแล้ว</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="select-wrap category-select-wrap">
        <Select name="category" defaultValue={category || "all"} onValueChange={value => onChange({ category: value === "all" ? undefined : value, status })}>
          <SelectTrigger aria-label="หมวดนิยาย"><SelectValue placeholder="ทุกหมวด" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวด</SelectItem>
            {categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
