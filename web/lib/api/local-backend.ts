import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, join, resolve } from "node:path";
import { handleLocalLibraryRequest } from "@/lib/api/local-library";

const defaultBackend = "http://127.0.0.1:8756";
const startupState = globalThis as typeof globalThis & {
  novelreadApiStartup?: Promise<boolean>;
  novelreadNodeFallbackServer?: Server;
  novelreadHandleLocalRequest?: typeof handleLocalLibraryRequest;
};
startupState.novelreadHandleLocalRequest = handleLocalLibraryRequest;

function projectRoot() {
  let candidate = process.cwd();
  for (let depth = 0; depth < 4; depth += 1) {
    if (existsSync(join(candidate, "server.py"))) return candidate;
    candidate = dirname(candidate);
  }
  return process.cwd();
}

async function backendIsReady() {
  try {
    const response = await fetch(`${defaultBackend}/api/config`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startNodeFallbackServer(): Promise<boolean> {
  if (startupState.novelreadNodeFallbackServer?.listening) return true;
  return new Promise<boolean>(resolvePromise => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", defaultBackend);
      if (url.pathname === "/api/config") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ engine: "edge", voice: "th-TH-PremwadeeNeural", port: 8756 }));
        return;
      }
      if (url.pathname.startsWith("/api/library/")) {
        const pathSegments = url.pathname
          .slice("/api/library/".length)
          .split("/")
          .filter(Boolean)
          .map(seg => decodeURIComponent(seg));
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const rawBuf = chunks.length ? Buffer.concat(chunks) : undefined;
          const rawArrayBuffer = rawBuf
            ? rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength)
            : undefined;
          const activeHandler = startupState.novelreadHandleLocalRequest ?? handleLocalLibraryRequest;
          const result = activeHandler(
            req.method ?? "GET",
            pathSegments,
            url.searchParams,
            rawArrayBuffer,
            req.headers.cookie,
          );
          const headers: Record<string, string> = { ...(result.headers ?? {}) };
          if (result.rawBuffer) {
            res.writeHead(result.status, headers);
            res.end(result.rawBuffer);
          } else {
            headers["content-type"] = "application/json; charset=utf-8";
            res.writeHead(result.status, headers);
            res.end(JSON.stringify(result.body));
          }
        });
        return;
      }
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ detail: "Not Found" }));
    });

    server.once("error", () => {
      resolvePromise(false);
    });
    server.listen(8756, "127.0.0.1", () => {
      startupState.novelreadNodeFallbackServer = server;
      resolvePromise(true);
    });
  });
}

export async function ensureLocalBackend() {
  try {
    handleLocalLibraryRequest("GET", ["books"], new URLSearchParams(), undefined);
  } catch {
    // Ignore warmup errors
  }
  const backend = (process.env.FASTAPI_ORIGIN ?? defaultBackend).replace(/\/$/, "");
  if (backend !== defaultBackend) return false;
  if (await backendIsReady()) return true;

  if (!startupState.novelreadApiStartup) {
    startupState.novelreadApiStartup = (async () => {
      const root = projectRoot();
      const python = resolve(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
      if (existsSync(python)) {
        const child = spawn(python, ["-X", "utf8", "-u", "server.py"], {
          cwd: root,
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        let spawnFailed = false;
        child.once("error", () => { spawnFailed = true; });
        child.unref();

        const deadline = Date.now() + 8_000;
        while (!spawnFailed && child.exitCode === null && Date.now() < deadline) {
          if (await backendIsReady()) return true;
          await new Promise(resolveDelay => setTimeout(resolveDelay, 300));
        }
      }
      return startNodeFallbackServer();
    })().finally(() => { startupState.novelreadApiStartup = undefined; });
  }
  return startupState.novelreadApiStartup;
}


