import { DatabaseSync } from "node:sqlite";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

let root = process.cwd();
for (let depth = 0; depth < 4 && !existsSync(join(root, "server.py")); depth += 1) root = dirname(root);
const dbPath = resolve(process.env.NOVELREAD_DB ?? join(root, "data", "novelread.db"));
const outputPath = resolve(process.argv[2] ?? join(root, "data", "supabase-import.json"));
if (!existsSync(dbPath)) throw new Error(`SQLite database not found: ${dbPath}`);

const db = new DatabaseSync(dbPath, { readOnly: true });
try {
  const users = db.prepare("SELECT id, email, name FROM users ORDER BY id").all();
  const books = db.prepare("SELECT * FROM books ORDER BY id").all();
  const chapters = db.prepare("SELECT * FROM chapters ORDER BY id").all();
  const shelf = db.prepare("SELECT * FROM shelf ORDER BY user_id, book_id").all();
  const payload = { exported_at: new Date().toISOString(), users, books, chapters, shelf };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ output: outputPath, users: users.length, books: books.length, chapters: chapters.length, shelf: shelf.length }));
} finally {
  db.close();
}
