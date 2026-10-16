import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputPath = process.argv[2];
if (!url || !key || !inputPath) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then pass the export JSON path.");
const payload = JSON.parse(readFileSync(inputPath, "utf8"));
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function upsert(table, rows) {
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + 100), { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// Imported books remain unowned until the administrator verifies and assigns
// each legacy author. Never infer ownership from an unverified signup email.
await upsert("books", (payload.books ?? []).map(book => ({
  id: book.id, owner: null, legacy_owner_id: book.owner,
  title: book.title, pen_name: book.pen_name, summary: book.summary,
  category: book.category, tags: book.tags, cover: book.cover,
  rating: book.rating, status: book.status, updated: book.updated,
})));
await upsert("chapters", (payload.chapters ?? []).map(chapter => ({
  id: chapter.id, book_id: chapter.book_id, title: chapter.title,
  content: chapter.content, published: Boolean(chapter.published),
  position: chapter.position, updated: chapter.updated,
})));
for (const table of ["books", "chapters"]) {
  const { error } = await supabase.rpc("setval_for_import", { table_name: table });
  if (error) throw new Error(`Failed to synchronize ${table} IDs: ${error.message}`);
}
console.log(JSON.stringify({ books: payload.books?.length ?? 0, chapters: payload.chapters?.length ?? 0, legacy_accounts_pending: payload.users?.length ?? 0 }));
