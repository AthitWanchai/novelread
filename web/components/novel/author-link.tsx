import Link from "next/link";

export function AuthorLink({ id, name }: { id: number | null; name: string }) {
  return id ? <Link className="author-link" href={`/author/${id}`}>{name}</Link> : <span>{name}</span>;
}
