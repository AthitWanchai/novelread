"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Search, UserRound, ChevronDown, House, Library, PenLine, Headphones, LayoutGrid } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { legacyListenUrl } from "@/lib/site";

const links = [{ href: "/", label: "หน้าแรก", icon: House }, { href: "/#categories", label: "หมวดหมู่", icon: LayoutGrid }, { href: "/shelf", label: "ชั้นหนังสือ", icon: Library }, { href: "/studio", label: "เขียนนิยาย", icon: PenLine }];
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="header-inner"><Brand /><nav className="primary-nav" aria-label="เมนูหลัก">{links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link>)}</nav><div className="header-actions"><Button variant="ghost" size="icon" asChild><Link href="/#discover" aria-label="ค้นหานิยาย"><Search /></Link></Button><div className="desktop-account"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" aria-label="เมนูบัญชี"><UserRound /><span>บัญชี</span><ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href="/account">บัญชี / เข้าสู่ระบบ</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/shelf">ชั้นหนังสือ</Link></DropdownMenuItem>{legacyListenUrl && <DropdownMenuItem asChild><a href={legacyListenUrl}>ฟังจากลิงก์</a></DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button className="mobile-menu-toggle" variant="ghost" size="icon" aria-label="เปิดเมนู"><Menu /></Button></SheetTrigger><SheetContent className="mobile-nav-sheet"><SheetHeader><SheetTitle>เมนู</SheetTitle><SheetDescription>เลือกส่วนที่ต้องการใช้งาน</SheetDescription></SheetHeader><nav className="mobile-nav-links" aria-label="เมนูมือถือ">{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={path === link.href ? "page" : undefined}><link.icon />{link.label}</Link>)}{legacyListenUrl && <a href={legacyListenUrl}><Headphones />ฟังจากลิงก์</a>}<Link href="/account" onClick={() => setOpen(false)}><UserRound />บัญชี / เข้าสู่ระบบ</Link></nav></SheetContent></Sheet></div></div></header>;
}
