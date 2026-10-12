import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const defaultBackend = "http://127.0.0.1:8756";
const startupState = globalThis as typeof globalThis & { novelreadApiStartup?: Promise<boolean> };

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

export async function ensureLocalBackend() {
  const backend = (process.env.FASTAPI_ORIGIN ?? defaultBackend).replace(/\/$/, "");
  if (process.env.NODE_ENV !== "development" || backend !== defaultBackend) return false;
  if (await backendIsReady()) return true;

  if (!startupState.novelreadApiStartup) {
    startupState.novelreadApiStartup = (async () => {
      const root = projectRoot();
      const python = resolve(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
      if (!existsSync(python)) return false;

      const child = spawn(python, ["-X", "utf8", "-u", "server.py"], {
        cwd: root,
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
