import type { MetadataRoute } from "next";
import { getNovel, listNovels, slugify } from "@/lib/api/novels";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return [];
  const novels = await listNovels().catch(() => []);
  const details = await Promise.all(novels.map(novel => getNovel(String(novel.id))));
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...[...new Set(novels.map(novel => novel.owner).filter(Boolean))].map(id => ({ url: `${base}/author/${id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...novels.flatMap((novel, index) => {
      const detail = details[index];
      const novelPath = `/novel/${novel.id}/${slugify(novel.title)}`;
      return [
        { url: `${base}${novelPath}`, lastModified: new Date(novel.updated * 1000), changeFrequency: "weekly" as const, priority: 0.8 },
        ...(detail?.chapters ?? []).map((chapter, chapterIndex) => ({
          url: `${base}${novelPath}/chapter/${chapter.id}/${slugify(chapter.title)}`,
          lastModified: new Date(chapter.updated * 1000),
          changeFrequency: "monthly" as const,
          priority: chapterIndex === 0 ? 0.7 : 0.6,
        })),
      ];
    }),
  ];
}
