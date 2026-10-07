"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { legacyListenUrl } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const links = [
  { href: "/", label: "ค้นพบ", matches: (path: string) => path === "/" },
  { href: "/shelf", label: "ชั้นหนังสือ", matches: (path: string) => path.startsWith("/shelf") },
  { href: "/studio", label: "เขียนนิยาย", matches: (path: string) => path.startsWith("/studio") },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Novelread หน้าแรก" onClick={closeMenu}>
          <span className="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 9.2c-3-2-6.5-2.3-10-.9v14.1c3.5-1.4 7-1.1 10 .9 3-2 6.5-2.3 10-.9V8.3c-3.5-1.4-7-1.1-10 .9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M16 9.2v14.1M9 12.1c1.8-.5 3.7-.3 5.3.5M18 12.6c1.7-.8 3.5-1 5.1-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="m23.5 4.4.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" fill="#cfaa6b" />
            </svg>
          </span>
          <span className="brand-word">novel<span>read</span></span>
        </Link>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><Button variant="outline" size="icon" className="mobile-menu-toggle" aria-label="เปิดเมนู"><Menu aria-hidden="true" /></Button></SheetTrigger>
          <SheetContent side="right" className="mobile-nav-sheet">
            <SheetHeader><SheetTitle>เมนูหลัก</SheetTitle><SheetDescription>ไปยังส่วนต่าง ๆ ของ Novelread</SheetDescription></SheetHeader>
            <nav className="mobile-nav-links" aria-label="เมนูมือถือ">
              {links.map(link => {
                const active = link.matches(pathname);
                return <Link key={link.href} href={link.href} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined} onClick={closeMenu}>{link.label}</Link>;
              })}
              <Link className={pathname.startsWith("/account") ? "nav-active" : undefined} href="/account" aria-current={pathname.startsWith("/account") ? "page" : undefined} onClick={closeMenu}>บัญชี</Link>
              {legacyListenUrl && <a href={legacyListenUrl} onClick={closeMenu}>ฟังจากลิงก์ <span aria-hidden="true">↗</span></a>}
            </nav>
          </SheetContent>
        </Sheet>
        <nav id="primary-navigation" className="primary-nav" aria-label="เมนูหลัก">
          {links.map(link => {
            const active = link.matches(pathname);
            return <Link key={link.href} href={link.href} className={active ? "nav-active" : undefined} aria-current={active ? "page" : undefined} onClick={closeMenu}>{link.label}</Link>;
          })}
        </nav>
        <div className="header-actions"><Link className={`header-account${pathname.startsWith("/account") ? " nav-active" : ""}`} href="/account" aria-current={pathname.startsWith("/account") ? "page" : undefined}>บัญชี</Link>{legacyListenUrl && <a className="header-listen" href={legacyListenUrl}>ฟังจากลิงก์ <span aria-hidden="true">↗</span></a>}</div>
      </div>
    </header>
  );
}
