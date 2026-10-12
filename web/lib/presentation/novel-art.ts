import { coverUrl, type Novel } from "@/lib/api/novels";

const categoryArtwork: Record<string, string> = {
  "แฟนตาซี": "/demo-banners/fantasy-city.png",
  "สืบสวน": "/demo-banners/mystery-lane.png",
  "ผจญภัย": "/demo-banners/adventure-bridge.png",
};

export function novelBackdrop(novel: Pick<Novel, "category" | "cover">) {
  return categoryArtwork[novel.category] || coverUrl(novel.cover) || "/demo-banners/fantasy-city.png";
}
