import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="content-shell page-loading" role="status" aria-label="กำลังโหลดหน้า">
      <Skeleton className="loading-eyebrow" aria-hidden="true" />
      <Skeleton className="loading-heading" aria-hidden="true" />
      <div className="loading-feature" aria-hidden="true">
        <Skeleton className="loading-cover" />
        <div className="loading-copy"><Skeleton /><Skeleton /><Skeleton /><Skeleton className="loading-copy-short" /></div>
      </div>
      <div className="loading-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <Skeleton className="loading-card" key={index} />)}</div>
      <span className="sr-only">กำลังโหลดเนื้อหา…</span>
    </section>
  );
}
