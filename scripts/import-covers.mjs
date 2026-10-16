import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [exportPath, coversDir = "data/covers"] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !exportPath) throw new Error("Usage: node scripts/import-covers.mjs <export.json> [covers-directory]");
const { books = [] } = JSON.parse(readFileSync(exportPath, "utf8"));
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
let migrated = 0;
for (const book of books) {
  if (!String(book.cover ?? "").startsWith("/api/library/covers/")) continue;
  const name = basename(book.cover);
  if (!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(name)) throw new Error(`Invalid cover path for book ${book.id}`);
  const file = resolve(join(coversDir, name));
  if (!existsSync(file)) throw new Error(`Missing cover for book ${book.id}: ${file}`);
  const contentType = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const { error: uploadError } = await supabase.storage.from("covers").upload(`legacy/${name}`, readFileSync(file), { contentType, upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("covers").getPublicUrl(`legacy/${name}`);
  const { error: updateError } = await supabase.from("books").update({ cover: data.publicUrl }).eq("id", book.id);
  if (updateError) throw updateError;
  migrated++;
}
console.log(JSON.stringify({ migrated }));
