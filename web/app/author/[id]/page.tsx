import { notFound } from "next/navigation";
import Link from "next/link";
import { Feather } from "lucide-react";
import { getAuthor } from "@/lib/api/novels";
import { AuthorWorks } from "@/features/authors/author-works";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const data = await getAuthor((await params).id);
  return { title: data ? `ผลงานของ ${data.author.name}` : "ไม่พบนักเขียน", alternates: { canonical: `/author/${(await params).id}` } };
}
export default async function AuthorProfile({ params }: { params: Promise<{ id: string }> }) {
  const data = await getAuthor((await params).id);
  if (!data) notFound();
  return <div className="content-shell author-page"><nav className="breadcrumbs" aria-label="เส้นทางหน้า"><Link href="/">หน้าแรก</Link><span>/</span><span>{data.author.name}</span></nav><header className="author-masthead"><div className="author-avatar" aria-hidden="true"><Feather /></div><div><span className="section-kicker">นักเขียน</span><h1>{data.author.name}</h1><p>ผลงานนิยายที่เผยแพร่บน Novelread</p></div></header><AuthorWorks initial={data} /></div>;
}
