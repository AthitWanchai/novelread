"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { libraryRequest, type ReaderAccount } from "@/lib/api/client";
import { FeedbackPanel } from "@/components/ui/feedback-panel";
import { ActionButton, ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function AccountScreen() {
  const [account, setAccount] = useState<ReaderAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    libraryRequest<ReaderAccount | null>("/me").then(setAccount).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await libraryRequest<ReaderAccount>(register ? "/register" : "/login", "POST", {
        email: data.get("email"), password: data.get("password"), name: data.get("name") ?? "",
      });
      setAccount(result);
    } catch (e) { setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่ได้"); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError("");
    try { await libraryRequest("/logout", "POST", {}); setAccount(null); }
    catch (e) { setError(e instanceof Error ? e.message : "ออกจากระบบไม่ได้"); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="content-shell"><FeedbackPanel>กำลังตรวจสอบบัญชี…</FeedbackPanel></div>;
  if (account) return (
    <div className="content-shell"><Card asChild className="account-card"><section>
      <span className="section-kicker">YOUR NOVELREAD</span><h1>ยินดีต้อนรับ, {account.name}</h1>
      <p className="account-email">{account.email}</p><p className="detail-summary">บัญชีของคุณพร้อมบันทึกชั้นหนังสือและผลงานไว้ที่นี่</p>
      <div className="account-actions"><ActionLink className="hero-cta" href="/shelf">ไปชั้นหนังสือ <span>→</span></ActionLink><Link className="plain-link" href="/studio">พื้นที่นักเขียน</Link><Button variant="ghost" className="text-button" type="button" onClick={logout} disabled={busy}>ออกจากระบบ</Button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section></Card></div>
  );

  return (
    <div className="content-shell"><Card asChild className="account-card"><section>
      <span className="section-kicker">A HOME FOR YOUR STORIES</span><h1>{register ? "เริ่มต้นเป็นส่วนหนึ่งของ Novelread" : "กลับมาอ่านต่อกันนะ"}</h1>
      <p className="account-intro">{register ? "สร้างบัญชีเพื่อบันทึกชั้นหนังสือและเริ่มเขียนเรื่องของคุณ" : "เข้าสู่ระบบเพื่อกลับไปยังชั้นหนังสือและผลงานของคุณ"}</p>
      <form className="account-form" onSubmit={submit}>
        {register && <div className="account-field"><Label htmlFor="account-name">ชื่อแสดง / นามปากกา</Label><Input id="account-name" name="name" required maxLength={80} autoComplete="nickname" /></div>}
        <div className="account-field"><Label htmlFor="account-email">อีเมล</Label><Input id="account-email" name="email" type="email" required maxLength={254} autoComplete="email" /></div>
        <div className="account-field"><Label htmlFor="account-password">รหัสผ่าน</Label><Input id="account-password" name="password" type="password" required minLength={8} maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <ActionButton type="submit" className="search-button account-submit" disabled={busy}>{busy ? "กำลังดำเนินการ…" : register ? "สร้างบัญชี" : "เข้าสู่ระบบ"}<span>→</span></ActionButton>
      </form>
      <Separator className="account-separator" />
      <p className="account-switch">{register ? "มีบัญชีแล้ว?" : "ยังไม่มีบัญชี?"} <Button variant="ghost" type="button" className="text-button" onClick={() => { setRegister(!register); setError(""); }}>{register ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</Button></p>
    </section></Card></div>
  );
}
