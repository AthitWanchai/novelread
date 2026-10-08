import Link from "next/link";
import { Brand } from "./brand";
import { legacyListenUrl } from "@/lib/site";

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-inner"><div><Brand /><p>พื้นที่สำหรับนักอ่านและนักเขียน</p></div><nav aria-label="เมนูท้ายเว็บ"><Link href="/">หน้าแรก</Link><Link href="/#categories">หมวดหมู่</Link><Link href="/shelf">ชั้นหนังสือ</Link><Link href="/studio">เขียนนิยาย</Link>{legacyListenUrl && <a href={legacyListenUrl}>ฟังจากลิงก์</a>}<Link href="/account">บัญชี</Link></nav></div><p className="copyright">© {new Date().getFullYear()} Novelread</p></footer>;
}
