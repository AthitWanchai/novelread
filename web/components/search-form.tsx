"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { ActionButton } from "@/components/ui/action-link";
import { Input } from "@/components/ui/input";
import { SearchFilters } from "@/components/search-filters";

type SearchFormProps = { initialQuery?: string; category?: string; status?: string; categories: string[] };

export function SearchForm({ initialQuery = "", category, status, categories }: SearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const categoryRef = useRef(category);
  const statusRef = useRef(status);

  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (categoryRef.current) params.set("category", categoryRef.current);
    if (statusRef.current) params.set("status", statusRef.current);
    const target = params.size ? `/?${params}` : "/";
    startTransition(() => router.push(target, { scroll: false }));
  }

  return <div className="search-group" role="search">
    <form className="hero-search" onSubmit={search}>
      <label className="search-input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg><Input name="q" value={query} onChange={event => setQuery(event.target.value)} placeholder="ชื่อเรื่อง นักเขียน หรือแนวที่ชอบ" aria-label="ค้นหานิยาย" /></label>
      <ActionButton className="search-button" type="submit" disabled={pending}>{pending ? <><LoaderCircle aria-hidden="true" className="filter-spinner" /> กำลังค้นหา…</> : <>ค้นหา <span aria-hidden="true">↗</span></>}</ActionButton>
    </form>
    <SearchFilters category={category} status={status} categories={categories} onChange={next => { categoryRef.current = next.category; statusRef.current = next.status; }} />
  </div>;
}
