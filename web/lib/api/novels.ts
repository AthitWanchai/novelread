const origin = (process.env.FASTAPI_ORIGIN ?? "http://127.0.0.1:8756").replace(/\/$/, "");

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
  const response = await fetch(`${origin}/api/library${path}`, { cache: "no-store" });
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
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}
