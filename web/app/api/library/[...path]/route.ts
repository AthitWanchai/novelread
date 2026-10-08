import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const backend = (process.env.FASTAPI_ORIGIN ?? "http://127.0.0.1:8756").replace(/\/$/, "");
const startupState = globalThis as typeof globalThis & { novelreadApiStartup?: Promise<boolean> };

async function backendIsReady() {
  try {
    const response = await fetch(`${backend}/api/config`, {
      cache: "no-store",
      signal: AbortSignal.timeout(800),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startLocalBackend() {
  if (process.env.NODE_ENV !== "development" || backend !== "http://127.0.0.1:8756") return false;
  if (await backendIsReady()) return true;
  if (!startupState.novelreadApiStartup) {
    startupState.novelreadApiStartup = (async () => {
      const python = resolve(
        process.cwd(),
        ".venv",
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      );
      if (!existsSync(python)) return false;

      const child = spawn(python, ["-X", "utf8", "-u", "server.py"], {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      let spawnFailed = false;
      child.once("error", () => { spawnFailed = true; });
      child.unref();

      const deadline = Date.now() + 20_000;
      while (!spawnFailed && child.exitCode === null && Date.now() < deadline) {
        if (await backendIsReady()) return true;
        await new Promise(resolveDelay => setTimeout(resolveDelay, 300));
      }
      return false;
    })().finally(() => { startupState.novelreadApiStartup = undefined; });
  }
  return startupState.novelreadApiStartup;
}

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
    if (!(await startLocalBackend())) {
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
