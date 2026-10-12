export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "development") {
    const { ensureLocalBackend } = await import("@/lib/api/local-backend");
    await ensureLocalBackend();
  }
}
