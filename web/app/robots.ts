import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const production = Boolean(process.env.NEXT_PUBLIC_SITE_URL);
  return {
    rules: production
      ? { userAgent: "*", allow: "/", disallow: ["/api/", "/studio/", "/account/"] }
      : { userAgent: "*", disallow: "/" },
    ...(production ? { sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml` } : {}),
  };
}
