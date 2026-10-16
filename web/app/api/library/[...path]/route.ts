import { NextRequest, NextResponse } from "next/server";
import { ensureLocalBackend } from "@/lib/api/local-backend";
import { handleSupabaseLibraryRequest } from "@/lib/api/supabase-library";

const backend = (process.env.FASTAPI_ORIGIN ?? "http://127.0.0.1:8756").replace(/\/$/, "");

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ detail: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  }

  const { path } = await context.params;
  const cloudConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY);
  const cloudAttempted = Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  if (!cloudConfigured && (process.env.NODE_ENV === "production" || cloudAttempted)) {
    return NextResponse.json({ detail: "ยังไม่ได้ตั้งค่าฐานข้อมูลออนไลน์" }, { status: 503 });
  }
  if (cloudConfigured) {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    const result = await handleSupabaseLibraryRequest(
      request.method,
      path,
      new URL(request.url).searchParams,
      body,
      request.headers.get("cookie"),
    );
    const responseHeaders = new Headers(result.headers);
    if (result.rawBuffer) {
      return new Response(new Uint8Array(result.rawBuffer), { status: result.status, headers: responseHeaders });
    }
    responseHeaders.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(result.body), { status: result.status, headers: responseHeaders });
  }

  const search = new URL(request.url).search;
  const target = `${backend}/api/library/${path.map(encodeURIComponent).join("/")}${search}`;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const init: RequestInit = {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  };
  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    if (!(await ensureLocalBackend())) {
      return NextResponse.json(
        { detail: "เริ่ม API ของ Novelread ไม่สำเร็จ กรุณาตรวจการติดตั้ง Python และลองเปิดโปรเจกต์ด้วย start.bat" },
        { status: 503 },
      );
    }
    try {
      upstream = await fetch(target, init);
    } catch {
      return NextResponse.json(
        { detail: "API ของ Novelread ยังไม่พร้อม กรุณากดลองอีกครั้ง" },
        { status: 503 },
      );
    }
  }
  const responseHeaders = new Headers();
  for (const name of ["content-type", "cache-control", "set-cookie", "x-content-type-options"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
