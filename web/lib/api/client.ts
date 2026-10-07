export async function libraryRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/library${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error("เชื่อมต่อระบบไม่สำเร็จ"); }
  if (!response.ok) {
    const detail = typeof result === "object" && result !== null && "detail" in result ? result.detail : null;
    throw new Error(typeof detail === "string" ? detail : "กรุณาตรวจข้อมูลที่กรอกแล้วลองอีกครั้ง");
  }
  return result as T;
}

export type ReaderAccount = { id: number; email: string; name: string };
