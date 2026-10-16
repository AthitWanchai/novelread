const cloudConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY);
const origin = cloudConfigured
  ? (process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")
  : (process.env.FASTAPI_ORIGIN ?? "http://127.0.0.1:8756").replace(/\/$/, "");
const localAppOrigin = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

class NovelApiError extends Error {
  constructor(public readonly status: number) {
    super(`Novelread API returned ${status}`);
    this.name = "NovelApiError";
  }
}

export type ChapterSummary = {
  id: number;
  title: string;
  published: boolean;
  position: number;
  updated: number;
};

export type Novel = {
  id: number;
  owner: number | string | null;
  title: string;
  pen_name: string;
  summary: string;
  category: string;
  tags: string;
  cover: string;
  rating: string;
  status: string;
  updated: number;
  chapter_count?: number;
  chapters?: ChapterSummary[];
  is_owner?: boolean;
};

export type Chapter = ChapterSummary & {
  book_id: number;
  content: string;
  book_title: string;
};

async function api<T>(path: string): Promise<T> {
  if (cloudConfigured && process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for cloud deployment");
  }
  let response: Response;
  try {
    response = await fetch(`${origin}/api/library${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(800),
    });
  } catch {
    response = await fetch(`${localAppOrigin}/api/library${path}`, {
      cache: "no-store",
    });
  }
  if (!response.ok) throw new NovelApiError(response.status);
  return response.json() as Promise<T>;
}

export function listNovels(filters: { q?: string; category?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.category) query.set("category", filters.category);
  if (filters.status) query.set("status", filters.status);
  const suffix = query.size ? `?${query}` : "";
  return api<Novel[]>(`/books${suffix}`);
}

export async function getNovel(id: string): Promise<Novel | null> {
  try {
    return await api<Novel>(`/books/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof NovelApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getChapter(id: string): Promise<Chapter | null> {
  try {
    return await api<Chapter>(`/chapters/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof NovelApiError && error.status === 404) return null;
    throw error;
  }
}

export function slugify(value: string) {
  return value.trim().toLocaleLowerCase("th-TH")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "") || "novel";
}

export function coverUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/library/")) return path;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

export type AuthorPage = { author: { id: number | string; name: string }; books: Novel[]; total: number; next_offset: number | null };
export async function getAuthor(id: string): Promise<AuthorPage | null> {
  try { return await api<AuthorPage>(`/authors/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof NovelApiError && error.status === 404) return null; throw error; }
}
