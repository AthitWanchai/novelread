"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Compass, LoaderCircle, Sparkles, X } from "lucide-react";
import { ActionButton } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchFilters } from "@/components/search-filters";

type SearchFormProps = { initialQuery?: string; category?: string; status?: string; categories: string[] };

export function SearchForm({ initialQuery = "", category, status, categories }: SearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const categoryRef = useRef(category);
  const statusRef = useRef(status);

  useEffect(() => { categoryRef.current = category; setSelectedCategory(category); }, [category]);
  useEffect(() => { statusRef.current = status; setSelectedStatus(status); }, [status]);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    if (!initialQuery && !category && !status && document.querySelector(".empty-library")) {
      router.refresh();
    }
  }, [initialQuery, category, status, router]);

  function pushSearch(nextQuery: string, nextCategory?: string, nextStatus?: string) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextCategory) params.set("category", nextCategory);
    if (nextStatus) params.set("status", nextStatus);
    const target = params.size ? `/?${params}` : "/";
    startTransition(() => router.push(target, { scroll: false }));
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushSearch(query, categoryRef.current, statusRef.current);
  }

  function selectQuickCategory(nextCat?: string) {
    categoryRef.current = nextCat;
    setSelectedCategory(nextCat);
    pushSearch(query, nextCat, statusRef.current);
  }

  function toggleQuickCompleted() {
    const nextStatus = statusRef.current === "จบแล้ว" ? undefined : "จบแล้ว";
    statusRef.current = nextStatus;
    setSelectedStatus(nextStatus);
    pushSearch(query, categoryRef.current, nextStatus);
  }

  function resetAll() {
    setQuery("");
    categoryRef.current = undefined;
    statusRef.current = undefined;
    setSelectedCategory(undefined);
    setSelectedStatus(undefined);
    startTransition(() => router.push("/", { scroll: false }));
  }

  const hasActiveFilters = Boolean(initialQuery || category || status);

  return (
    <div className="search-group" role="search">
      <form className="hero-search" onSubmit={search}>
        <label className="search-input-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          <Input name="q" value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาชื่อเรื่อง นามปากกา หรือแท็กที่สนใจ..." aria-label="ค้นหานิยาย" />
        </label>
        <ActionButton className="search-button" type="submit" disabled={pending}>
          {pending ? <><LoaderCircle aria-hidden="true" className="filter-spinner" /> กำลังค้นหา…</> : <>ค้นหา</>}
        </ActionButton>
        <SearchFilters
          category={selectedCategory}
          status={selectedStatus}
          categories={categories}
          onChange={next => {
            categoryRef.current = next.category;
            statusRef.current = next.status;
            setSelectedCategory(next.category);
            setSelectedStatus(next.status);
          }}
        />
      </form>
      <div className="quick-genre-bar" aria-label="เลือกหมวดหมู่ด่วน">
        <span className="quick-genre-label"><Compass aria-hidden="true" /> หมวดยอดนิยม:</span>
        <div className="quick-genre-pills">
          <button
            type="button"
            className={`genre-pill${!selectedCategory ? " is-active" : ""}`}
            onClick={() => selectQuickCategory(undefined)}
          >
            ทั้งหมด
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`genre-pill${selectedCategory === cat ? " is-active" : ""}`}
              onClick={() => selectQuickCategory(selectedCategory === cat ? undefined : cat)}
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            className={`genre-pill genre-pill-complete${selectedStatus === "จบแล้ว" ? " is-active" : ""}`}
            onClick={toggleQuickCompleted}
          >
            <Sparkles aria-hidden="true" /> จบแล้วอ่านรวดเดียว
          </button>
        </div>
      </div>
      {hasActiveFilters && (
        <div className="active-filters" aria-label="ตัวกรองที่ใช้อยู่">
          <span className="active-filters-label">ตัวกรองที่เลือก:</span>
          {initialQuery && <span className="filter-chip">คำค้น: “{initialQuery}”</span>}
          {category && <span className="filter-chip">หมวด: {category}</span>}
          {status && <span className="filter-chip">สถานะ: {status}</span>}
          <Button type="button" variant="ghost" size="sm" className="clear-filters-btn" onClick={resetAll} disabled={pending}>
            <X aria-hidden="true" /> ล้างตัวกรองทั้งหมด
          </Button>
        </div>
      )}
    </div>
  );
}


