"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, UserRound, ChevronDown, House, Library, PenLine, Headphones, LayoutGrid } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import { legacyListenUrl } from "@/lib/site";

const links = [
  { href: "/", label: "หน้าแรก", icon: House },
  { href: "/#categories", label: "หมวดหมู่", icon: LayoutGrid },
  { href: "/shelf", label: "ชั้นหนังสือ", icon: Library },
  { href: "/studio", label: "เขียนนิยาย", icon: PenLine },
];
const categories = ["แฟนตาซี", "รักโรแมนติก", "วาย", "สืบสวน", "ผจญภัย", "ดราม่า", "อื่น ๆ"];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<ReaderAccount | null>(null);

  useEffect(() => {
    let active = true;
    libraryRequest<ReaderAccount | null>("/me")
      .then(user => { if (active) setAccount(user); })
      .catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, [path]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="primary-nav" aria-label="เมนูหลัก">
          <Link href="/" aria-current={path === "/" ? "page" : undefined}>หน้าแรก</Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="category-nav-trigger" variant="ghost" aria-label="เลือกหมวดหมู่นิยาย">
                <LayoutGrid /><span>หมวดหมู่</span><ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" aria-label="หมวดหมู่นิยาย">
              {categories.map(category => (
                <DropdownMenuItem asChild key={category}>
                  <Link href={`/?category=${encodeURIComponent(category)}`}>{category}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/shelf" aria-current={path === "/shelf" ? "page" : undefined}>ชั้นหนังสือ</Link>
          <Link href="/studio" aria-current={path.startsWith("/studio") ? "page" : undefined}>เขียนนิยาย</Link>
        </nav>
        <div className="header-actions">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/#discover" aria-label="ค้นหานิยาย"><Search /></Link>
          </Button>
          <div className="desktop-account">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="account-trigger" aria-label="เมนูบัญชี">
                  <span className="account-avatar" aria-hidden="true"><UserRound /></span>
                  <span className="account-trigger-name">{account ? account.name : "บัญชี"}</span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/account">{account ? `บัญชี (${account.name})` : "บัญชี / เข้าสู่ระบบ"}</Link>
                </DropdownMenuItem>
                {account && (
                  <DropdownMenuItem asChild>
                    <Link href={`/author/${account.id}`}>โปรไฟล์นักเขียน</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild><Link href="/shelf">ชั้นหนังสือ</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/studio">พื้นที่นักเขียน</Link></DropdownMenuItem>
                {legacyListenUrl && <DropdownMenuItem asChild><a href={legacyListenUrl}>ฟังจากลิงก์</a></DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="mobile-menu-toggle" variant="ghost" size="icon" aria-label="เปิดเมนู">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent className="mobile-nav-sheet">
              <SheetHeader>
                <SheetTitle>เมนู</SheetTitle>
                <SheetDescription>{account ? `สวัสดี, ${account.name}` : "เลือกส่วนที่ต้องการใช้งาน"}</SheetDescription>
              </SheetHeader>
              <nav className="mobile-nav-links" aria-label="เมนูมือถือ">
                {links.map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={path === link.href ? "page" : undefined}>
                    <link.icon />{link.label}
                  </Link>
                ))}
                {legacyListenUrl && <a href={legacyListenUrl}><Headphones />ฟังจากลิงก์</a>}
                <Link href="/account" onClick={() => setOpen(false)} aria-current={path === "/account" ? "page" : undefined}>
                  <UserRound />{account ? `บัญชี (${account.name})` : "บัญชี / เข้าสู่ระบบ"}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

