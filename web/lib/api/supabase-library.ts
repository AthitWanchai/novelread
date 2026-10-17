import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

type User = { id: string; email: string; name: string; role: "user" | "admin" };
type Book = Record<string, any>;
type Result = { status: number; headers?: Record<string, string>; body: unknown; rawBuffer?: Buffer };
type SessionTokens = { access_token: string; refresh_token?: string; expires_at?: number };
type AuthContext = { session: SessionTokens | null; setCookie?: string };
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const URL = process.env.SUPABASE_URL ?? "https://invalid.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "missing-supabase-server-key";
const client = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
function authClient() {
  const publishableKey = process.env.SUPABASE_ANON_KEY;
  if (!publishableKey) throw new Error("SUPABASE_ANON_KEY is required for cloud Auth");
  return createClient(URL, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
const COVER_BUCKET = "covers";

function fail(status: number, message: string): never { throw new HttpError(status, message); }
function sessionFrom(cookie?: string | null): SessionTokens | null {
  const pair = cookie?.split(";").map(value => value.trim()).find(value => value.startsWith("novelread_session="));
  if (!pair) return null;
  let raw: string;
  try { raw = decodeURIComponent(pair.slice("novelread_session=".length)); }
  catch { return null; }
  try {
    const value = JSON.parse(raw) as SessionTokens;
    if (typeof value.access_token === "string") return value;
  } catch { /* Support access-token cookies issued by earlier versions. */ }
  return raw ? { access_token: raw } : null;
}
function sessionCookie(session: SessionTokens) {
  const age = 60 * 60 * 24 * 30;
  const value: SessionTokens = { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at };
  return `novelread_session=${encodeURIComponent(JSON.stringify(value))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
function clearCookie() { return "novelread_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"; }
function account(user: User) { return user; }
async function getUser(cookie?: string | null, auth?: AuthContext): Promise<User | null> {
  const session = auth?.session ?? sessionFrom(cookie);
  if (!session?.access_token) return null;
  let user: any = null;
  let attemptedRefresh = false;
  if (session.refresh_token && session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
    attemptedRefresh = true;
    const refreshed = await client.auth.refreshSession({ refresh_token: session.refresh_token });
    if (!refreshed.error && refreshed.data.session) {
      auth && (auth.session = refreshed.data.session);
      auth && (auth.setCookie = sessionCookie(refreshed.data.session));
      user = refreshed.data.user;
    }
  }
  if (!user) {
    const verified = await client.auth.getUser(session.access_token);
    if (!verified.error) user = verified.data.user;
  }
  if (!user && session.refresh_token && !attemptedRefresh) {
    const refreshed = await client.auth.refreshSession({ refresh_token: session.refresh_token });
    if (!refreshed.error && refreshed.data.session) {
      auth && (auth.session = refreshed.data.session);
      auth && (auth.setCookie = sessionCookie(refreshed.data.session));
      user = refreshed.data.user;
    }
  }
  if (!user) return null;
  const { data: profile } = await client.from("profiles").select("id,name,role").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? "", name: profile.name, role: profile.role === "admin" ? "admin" : "user" };
}
async function requireUser(cookie?: string | null, auth?: AuthContext) {
  const user = await getUser(cookie, auth);
  if (!user) fail(401, "กรุณาเข้าสู่ระบบก่อน");
  return user;
}
async function requireAdmin(cookie?: string | null, auth?: AuthContext) {
  const user = await requireUser(cookie, auth);
  if (user.role !== "admin") fail(403, "ต้องใช้บัญชีผู้ดูแลระบบ");
  return user;
}
async function ensureProfile(user: Pick<User, "id" | "name">) {
  const { data, error } = await client.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (data) {
    return;
  }
  const { error: insertError } = await client.from("profiles").upsert({ id: user.id, name: user.name }, { onConflict: "id" });
  if (insertError) throw insertError;
}
async function ownedBook(id: number, user: User) {
  const { data, error } = await client.from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) fail(404, "ไม่พบเรื่องนี้");
  if (data.owner !== user.id && user.role !== "admin") fail(403, "แก้ไขได้เฉพาะผลงานของคุณ");
  return data as Book;
}
function normalizeBook(raw: Record<string, unknown>) {
  const book = {
    title: String(raw.title ?? ""), pen_name: String(raw.pen_name ?? ""), summary: String(raw.summary ?? ""),
    category: String(raw.category ?? "แฟนตาซี"), tags: String(raw.tags ?? ""), cover: String(raw.cover ?? ""),
    rating: String(raw.rating ?? "ทั่วไป"), status: String(raw.status ?? "กำลังเขียน"),
  };
  if (!book.title.trim() || !book.pen_name.trim()) fail(400, "กรอกชื่อเรื่องและนามปากกา");
  if (!["ทั่วไป", "18+"].includes(book.rating) || !["กำลังเขียน", "จบแล้ว"].includes(book.status)) fail(400, "สถานะหรือเรตไม่ถูกต้อง");
  if (book.cover && !/^https?:\/\//i.test(book.cover) && !/^https:\/\/[^/]+\/storage\/v1\/object\/public\/covers\//.test(book.cover)) fail(400, "ลิงก์ปกไม่ถูกต้อง");
  return book;
}
async function checked<T>(query: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data as T;
}
async function publicBooks() {
  const books = await checked<any[]>(client.from("books").select("*").order("updated", { ascending: false }));
  const rows: Book[] = [];
  for (const book of books) {
    const { count, error } = await client.from("chapters").select("id", { count: "exact", head: true }).eq("book_id", book.id).eq("published", true);
    if (error) throw error;
    if (!count) continue;
    rows.push({ ...book, owner: book.owner ?? book.legacy_owner_id, chapter_count: count });
  }
  return rows;
}

export async function handleSupabaseLibraryRequest(method: string, path: string[], params: URLSearchParams, rawBody: ArrayBuffer | undefined, cookie?: string | null): Promise<Result> {
  const auth: AuthContext = { session: sessionFrom(cookie) };
  const result = await handleSupabaseLibraryRequestCore(method, path, params, rawBody, cookie, auth);
  if (auth.setCookie && !result.headers?.["set-cookie"]) result.headers = { ...result.headers, "set-cookie": auth.setCookie };
  return result;
}

async function handleSupabaseLibraryRequestCore(method: string, path: string[], params: URLSearchParams, rawBody: ArrayBuffer | undefined, cookie: string | null | undefined, auth: AuthContext): Promise<Result> {
  const parse = () => {
    try { return rawBody?.byteLength ? JSON.parse(Buffer.from(rawBody).toString("utf8")) as Record<string, any> : {}; }
    catch { fail(400, "รูปแบบข้อมูลไม่ถูกต้อง"); }
  };
  const [s0, s1, s2, s3] = path;
  try {
    if (s0 === "register" && method === "POST") {
      const body = parse(); const email = String(body.email ?? "").trim().toLowerCase(); const password = String(body.password ?? ""); const name = String(body.name ?? "").trim();
      if (!email.includes("@") || !name) fail(400, "กรอกอีเมลและนามปากกาให้ครบ");
      if (password.length < 8) fail(400, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      const { data, error } = await authClient().auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/account` : undefined } });
      if (error) fail(/already/i.test(error.message) ? 409 : 400, /already/i.test(error.message) ? "อีเมลนี้มีบัญชีแล้ว" : "สมัครบัญชีไม่สำเร็จ กรุณาตรวจข้อมูล");
      if (!data.user) fail(500, "สมัครบัญชีไม่สำเร็จ กรุณาลองใหม่");
      const userId = data.user.id;
      if (!data.session) return { status: 200, body: { id: userId, email, name, role: "user", confirmation_required: true } };
      await ensureProfile({ id: userId, name });
      return { status: 200, headers: { "set-cookie": sessionCookie(data.session) }, body: { id: userId, email, name } };
    }
    if (s0 === "recover" && method === "POST") {
      const email = String(parse().email ?? "").trim().toLowerCase();
      if (!email.includes("@")) fail(400, "กรอกอีเมลให้ถูกต้อง");
      const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/account?reset=1`
        : undefined;
      const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) fail(503, "ส่งอีเมลตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่");
      return { status: 200, body: { ok: true } };
    }
    if (s0 === "reset-password" && method === "POST") {
      const body = parse();
      const token = String(body.access_token ?? "");
      const password = String(body.password ?? "");
      if (password.length < 8) fail(400, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      if (!token) fail(401, "ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง");
      const { data, error } = await authClient().auth.getUser(token);
      if (error || !data.user) fail(401, "ลิงก์ตั้งรหัสผ่านหมดอายุหรือไม่ถูกต้อง");
      const updated = await client.auth.admin.updateUserById(data.user.id, { password });
      if (updated.error) fail(503, "ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่");
      return { status: 200, body: { ok: true } };
    }
    if (s0 === "login" && method === "POST") {
      const body = parse(); const email = String(body.email ?? "").trim().toLowerCase(); const password = String(body.password ?? "");
      const { data, error } = await authClient().auth.signInWithPassword({ email, password });
      if (error || !data.user || !data.session) fail(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      await ensureProfile({ id: data.user.id, name: String(data.user.user_metadata?.name ?? "") });
      const profile = await checked<any>(client.from("profiles").select("id,name,role").eq("id", data.user.id).single());
      return { status: 200, headers: { "set-cookie": sessionCookie(data.session) }, body: account({ id: data.user.id, email, name: profile.name, role: profile.role === "admin" ? "admin" : "user" }) };
    }
    if (s0 === "me" && method === "GET") return { status: 200, body: await getUser(cookie, auth) };
    if (s0 === "logout" && method === "POST") {
      await requireUser(cookie, auth); const token = auth.session?.access_token; if (token) await client.auth.admin.signOut(token);
      return { status: 200, headers: { "set-cookie": clearCookie() }, body: { ok: true } };
    }
    if (s0 === "profile" && method === "PUT") {
      const current = await requireUser(cookie, auth); const name = String(parse().name ?? "").trim(); if (!name) fail(400, "กรอกนามปากกา");
      const profile = await checked<any>(client.from("profiles").update({ name }).eq("id", current.id).select("id,name").single());
      if (current.id) await client.auth.admin.updateUserById(current.id, { user_metadata: { name } });
      return { status: 200, body: account({ id: current.id, email: current.email, name: profile.name, role: current.role }) };
    }
    if (s0 === "admin" && s1 === "users" && !s2 && method === "GET") {
      await requireAdmin(cookie, auth);
      const [profiles, authUsers] = await Promise.all([
        checked<any[]>(client.from("profiles").select("id,name,role,created_at").order("created_at", { ascending: false })),
        client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (authUsers.error) throw authUsers.error;
      const emailById = new Map((authUsers.data.users ?? []).map(user => [user.id, user.email ?? ""]));
      return { status: 200, body: profiles.map(profile => ({ ...profile, email: emailById.get(profile.id) ?? "" })) };
    }
    if (s0 === "admin" && s1 === "users" && s2 && s3 === "role" && method === "PUT") {
      const current = await requireAdmin(cookie, auth);
      const role = parse().role;
      if (role !== "user" && role !== "admin") fail(400, "บทบาทไม่ถูกต้อง");
      if (s2 === current.id && role !== "admin") fail(400, "ไม่สามารถลดสิทธิ์แอดมินของบัญชีที่กำลังใช้งานได้");
      const profile = await checked<any>(client.from("profiles").update({ role }).eq("id", s2).select("id,role").maybeSingle());
      if (!profile) fail(404, "ไม่พบบัญชีนี้");
      return { status: 200, body: profile };
    }
    if (s0 === "books" && !s1 && method === "GET") {
      const current = await getUser(cookie, auth); const mine = params.get("mine") === "true";
      if (mine && !current) fail(401, "กรุณาเข้าสู่ระบบก่อน");
      let rows: any[] = mine ? await checked<any[]>(client.from("books").select("*").eq("owner", current!.id).order("updated", { ascending: false })) : await publicBooks();
      const q = (params.get("q") ?? "").trim().toLocaleLowerCase("th-TH");
      if (q) rows = (rows as Book[]).filter(b => `${b.title}${b.pen_name}${b.tags}`.toLocaleLowerCase("th-TH").includes(q));
      if (params.get("category")) rows = (rows as Book[]).filter(b => b.category === params.get("category"));
      if (params.get("status")) rows = (rows as Book[]).filter(b => b.status === params.get("status"));
      return { status: 200, body: rows };
    }
    if (s0 === "books" && !s1 && method === "POST") {
      const current = await requireUser(cookie, auth); await ensureProfile(current); const row = await checked<any>(client.from("books").insert({ ...normalizeBook(parse()), owner: current.id, updated: Date.now() / 1000 }).select("id").single());
      return { status: 200, body: { id: row.id } };
    }
    if (s0 === "books" && s1 && !s2 && method === "GET") {
      const id = Number(s1); const current = await getUser(cookie, auth);
      const book = await checked<Book | null>(client.from("books").select("*").eq("id", id).maybeSingle()); if (!book) fail(404, "ไม่พบเรื่องนี้");
      const owner = Boolean(current && book.owner === current.id);
      const admin = current?.role === "admin";
      const chapters = await checked(client.from("chapters").select("id,title,published,position,updated").eq("book_id", id).order("position").order("id"));
      const visible = (chapters as any[]).filter(ch => ch.published || owner || admin);
      if (!visible.length && !owner && !admin) fail(404, "ไม่พบเรื่องนี้");
      return { status: 200, body: { ...book, owner: book.owner ?? book.legacy_owner_id, is_owner: owner, chapters: visible } };
    }
    if (s0 === "books" && s1 && !s2 && method === "PUT") {
      const current = await requireUser(cookie, auth); const id = Number(s1); await ownedBook(id, current);
      await checked(client.from("books").update({ ...normalizeBook(parse()), updated: Date.now() / 1000 }).eq("id", id)); return { status: 200, body: { id } };
    }
    if (s0 === "books" && s1 && s2 === "chapters" && ["POST", "PUT"].includes(method)) {
      const current = await requireUser(cookie, auth); const bookId = Number(s1); await ownedBook(bookId, current); const body = parse();
      const title = String(body.title ?? ""); const content = String(body.content ?? ""); const published = Boolean(body.published);
      if (!title.trim()) fail(400, "กรอกชื่อตอน"); if (published && !content.trim()) fail(400, "เพิ่มเนื้อหาก่อนเผยแพร่");
      const now = Date.now() / 1000; let query;
      if (s3) query = client.from("chapters").update({ title, content, published, updated: now }).eq("id", Number(s3)).eq("book_id", bookId).select("id").single();
      else {
        const rows = await checked(client.from("chapters").select("position").eq("book_id", bookId).order("position", { ascending: false }).limit(1));
        query = client.from("chapters").insert({ book_id: bookId, title, content, published, position: ((rows as any[])[0]?.position ?? 0) + 1, updated: now }).select("id").single();
      }
      const saved = await checked<any>(query as any); await checked(client.from("books").update({ updated: now }).eq("id", bookId));
      return { status: 200, body: { id: saved.id } };
    }
    if (s0 === "books" && s1 && s2 === "order" && method === "PUT") {
      const current = await requireUser(cookie, auth); const bookId = Number(s1); await ownedBook(bookId, current); const body = parse(); const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
      const rows = await checked(client.from("chapters").select("id").eq("book_id", bookId)); const actual = (rows as any[]).map(row => Number(row.id));
      if (ids.length !== actual.length || new Set(ids).size !== actual.length || ids.some((id: number) => !actual.includes(id))) fail(400, "รายการตอนต้องครบและไม่ซ้ำ");
      for (let i = 0; i < ids.length; i++) await checked(client.from("chapters").update({ position: i + 1 }).eq("id", ids[i]));
      return { status: 200, body: { ok: true } };
    }
    if (s0 === "chapters" && s1 && method === "GET") {
      const current = await getUser(cookie, auth); const row = await checked<any>(client.from("chapters").select("*,books!inner(owner,title)").eq("id", Number(s1)).maybeSingle());
      if (!row || (!row.published && (!current || (row.books.owner !== current.id && current.role !== "admin")))) fail(404, "ไม่พบตอนที่เผยแพร่");
      return { status: 200, body: { ...row, book_title: row.books.title } };
    }
    if (s0 === "authors" && s1 && method === "GET") {
      const offset = Math.max(0, Number(params.get("offset") ?? 0)); const limit = Math.min(48, Math.max(1, Number(params.get("limit") ?? 12)));
      const legacyId = /^\d+$/.test(s1) ? Number(s1) : null;
      let query = client.from("books").select("*").order("updated", { ascending: false });
      query = legacyId === null ? query.eq("owner", s1) : query.eq("legacy_owner_id", legacyId);
      if (params.get("status")) query = query.eq("status", params.get("status")!);
      const { data, error } = await query; if (error) throw error;
      const visible: Book[] = [];
      for (const b of data ?? []) { const { count, error: chapterError } = await client.from("chapters").select("id", { count: "exact", head: true }).eq("book_id", b.id).eq("published", true); if (chapterError) throw chapterError; if (count) visible.push({ ...b, owner: b.owner ?? b.legacy_owner_id, chapter_count: count }); }
      const total = visible.length;
      const books = visible.slice(offset, offset + limit);
      const profile = legacyId === null ? await checked<any>(client.from("profiles").select("name").eq("id", s1).maybeSingle()) : null;
      if (!profile && !total) fail(404, "ไม่พบนักเขียน");
      return { status: 200, body: { author: { id: s1, name: profile?.name ?? visible[0]?.pen_name ?? "นักเขียน" }, books, total, next_offset: offset + books.length < total ? offset + books.length : null } };
    }
    if (s0 === "shelf" && !s1 && method === "GET") {
      const current = await requireUser(cookie, auth); const rows = await checked<any[]>(client.from("shelf").select("*,books!inner(*)").eq("user_id", current.id).order("updated", { ascending: false }));
      const shelf = await Promise.all(rows.map(async row => {
        const { count, error } = await client.from("chapters").select("id", { count: "exact", head: true }).eq("book_id", row.book_id).eq("published", true);
        if (error) throw error;
        return { ...row.books, chapter_count: count ?? 0, chapter_id: row.chapter_id, progress: row.progress, followed: row.followed, updated: row.updated, reading_updated: row.updated, anchor: row.anchor };
      }));
      return { status: 200, body: shelf };
    }
    if (s0 === "shelf" && s1 && method === "PUT") {
      const current = await requireUser(cookie, auth); const bookId = Number(s1); const body = parse(); const prev = await checked<any>(client.from("shelf").select("*").eq("user_id", current.id).eq("book_id", bookId).maybeSingle());
      const book = await checked<any>(client.from("books").select("id,owner").eq("id", bookId).maybeSingle());
      if (!book) fail(404, "ไม่พบเรื่องที่เผยแพร่");
      if (body.chapter_id != null) { const chapter = await checked(client.from("chapters").select("id").eq("id", Number(body.chapter_id)).eq("book_id", bookId).eq("published", true).maybeSingle()); if (!chapter) fail(400, "ตอนนี้ยังไม่เผยแพร่หรืออยู่คนละเรื่อง"); }
      const anchor = body.anchor && typeof body.anchor === "object" ? { paragraph: Math.max(0, Number(body.anchor.paragraph ?? 0)), character: Math.max(0, Number(body.anchor.character ?? 0)) } : null;
      const { count: publishedCount, error: publishedError } = await client.from("chapters").select("id", { count: "exact", head: true }).eq("book_id", bookId).eq("published", true);
      if (publishedError) throw publishedError;
      if (book.owner !== current.id && !publishedCount) fail(404, "ไม่พบเรื่องที่เผยแพร่");
      const next = { user_id: current.id, book_id: bookId, chapter_id: body.chapter_id ?? prev?.chapter_id ?? null, progress: body.chapter_id != null ? Math.max(0, Math.min(1, Number(body.progress ?? 0))) : prev?.progress ?? 0, followed: body.followed != null ? Boolean(body.followed) : prev?.followed ?? false, anchor: body.chapter_id != null ? anchor : prev?.anchor ?? null, updated: Date.now() / 1000 };
      await checked(client.from("shelf").upsert(next, { onConflict: "user_id,book_id" })); return { status: 200, body: { ok: true } };
    }
    if (s0 === "covers" && !s1 && method === "POST") {
      const current = await requireUser(cookie, auth); const body = parse(); const content = Buffer.from(String(body.data ?? ""), "base64");
      if (!content.length || content.length > 5 * 1024 * 1024) fail(413, "ปกต้องมีขนาดไม่เกิน 5 MB");
      const type = content.subarray(0, 8).toString("hex").startsWith("89504e47") ? "image/png" : content[0] === 0xff && content[1] === 0xd8 ? "image/jpeg" : content.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp" : "";
      if (!type) fail(400, "เลือกรูป PNG, JPEG หรือ WebP เท่านั้น"); const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
      const path = `${current.id}/${createHash("sha256").update(content).digest("hex")}.${ext}`;
      const { error } = await client.storage.from(COVER_BUCKET).upload(path, content, { contentType: type, upsert: true }); if (error) throw error;
      const { data } = client.storage.from(COVER_BUCKET).getPublicUrl(path); return { status: 200, body: { url: data.publicUrl, media_type: type } };
    }
    if (s0 === "covers" && s1 && method === "GET") {
      const { data, error } = await client.storage.from(COVER_BUCKET).download(s1); if (error) fail(404, "ไม่พบปกรูปนี้");
      const bytes = Buffer.from(await data.arrayBuffer()); return { status: 200, headers: { "content-type": data.type || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" }, body: null, rawBuffer: bytes };
    }
    fail(404, "ไม่พบเส้นทาง API ที่ร้องขอ");
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, body: { detail: error.message } };
    console.error("Supabase library request failed", error);
    return { status: 500, body: { detail: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" } };
  }
}
