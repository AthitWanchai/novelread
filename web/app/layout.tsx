import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Novelread — อ่านนิยายเรื่องโปรด", template: "%s | Novelread" },
  description: "พื้นที่สำหรับนักอ่านและนักเขียน ค้นพบนิยายเรื่องใหม่ อ่านต่อได้ทุกวันกับ Novelread",
  alternates: { canonical: "/" },
  openGraph: { siteName: "Novelread", locale: "th_TH", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09141e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <a className="skip-link" href="#main">ข้ามไปเนื้อหา</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
