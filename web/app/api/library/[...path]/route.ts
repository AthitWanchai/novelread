import { NextRequest, NextResponse } from "next/server";
import { ensureLocalBackend } from "@/lib/api/local-backend";
import { handleLocalLibraryRequest } from "@/lib/api/local-library";
import { handleSupabaseLibraryRequest } from "@/lib/api/supabase-library";

const backend = (process.env.FASTAPI_ORIGIN ?? "http://127.0.0.1:8756").replace(/\/$/, "");

function runLocalFallback(request: NextRequest, path: string[], body: ArrayBuffer | undefined) {
  const url = new URL(request.url);
  const result = handleLocalLibraryRequest(
    request.method,
    path,
    url.searchParams,
    body,
    request.headers.get("cookie"),
  );
  const headers = new Headers(result.headers);
  if (result.rawBuffer) {
    return new Response(new Uint8Array(result.rawBuffer), { status: result.status, headers });
  }
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
  if (origin && host) {
    const originHost = new URL(origin).host;
    const directHost = request.headers.get("host");
    if (originHost !== host && originHost !== directHost) {
      return NextResponse.json({ detail: "ไม่อนุญาตคำขอจากเว็บไซต์อื่น" }, { status: 403 });
    }
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
    signal: AbortSignal.timeout(1500),
  };
  let upstream: Response;
  try {
    await ensureLocalBackend();
    upstream = await fetch(target, init);
  } catch {
    return runLocalFallback(request, path, body);
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
