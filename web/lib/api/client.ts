export async function libraryRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/library${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("เชื่อมต่อเว็บเซิร์ฟเวอร์ไม่ได้ กรุณารีเฟรชแล้วลองอีกครั้ง");
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(response.ok
      ? "ระบบส่งข้อมูลกลับมาไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง"
      : `ระบบขัดข้องชั่วคราว (HTTP ${response.status}) กรุณาลองใหม่อีกครั้ง`);
  }
  if (!response.ok) {
    const detail = typeof result === "object" && result !== null && "detail" in result ? result.detail : null;
    throw new Error(typeof detail === "string"
      ? detail
      : response.status >= 500
        ? "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"
        : "กรุณาตรวจข้อมูลที่กรอกแล้วลองอีกครั้ง");
  }
  return result as T;
}

export type ReaderAccount = { id: number; email: string; name: string };
