import { NextRequest, NextResponse } from "next/server";
import { ensureLocalBackend } from "@/lib/api/local-backend";

const backend = (process.env.FASTAPI_ORIGIN ?? "http://127.0.0.1:8756").replace(/\/$/, "");

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ detail: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
  }

  const { path } = await context.params;
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
