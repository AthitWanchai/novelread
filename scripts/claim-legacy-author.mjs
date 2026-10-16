import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [exportPath, legacyIdText, authUserId] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !exportPath || !legacyIdText || !authUserId) {
  throw new Error("Usage: node scripts/claim-legacy-author.mjs <export.json> <legacy-user-id> <auth-user-uuid>");
}
const legacyId = Number(legacyIdText);
if (!Number.isInteger(legacyId) || legacyId <= 0) throw new Error("Invalid legacy user ID");
const exported = JSON.parse(readFileSync(exportPath, "utf8"));
const oldUser = (exported.users ?? []).find(user => user.id === legacyId);
if (!oldUser) throw new Error("Legacy user not found in export");
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error: authError } = await supabase.auth.admin.getUserById(authUserId);
if (authError || !data.user) throw authError ?? new Error("Supabase user not found");
if (!data.user.email_confirmed_at || data.user.email?.toLowerCase() !== String(oldUser.email).toLowerCase()) {
  throw new Error("Supabase user must have a confirmed email matching the legacy account");
}
const { error: ownerError } = await supabase.from("books").update({ owner: authUserId })
  .eq("legacy_owner_id", legacyId).is("owner", null);
if (ownerError) throw ownerError;
const shelf = (exported.shelf ?? []).filter(item => item.user_id === legacyId).map(item => ({
  user_id: authUserId, book_id: item.book_id, chapter_id: item.chapter_id,
  progress: item.progress, followed: Boolean(item.followed), updated: item.updated,
  anchor: item.anchor ? JSON.parse(item.anchor) : null,
}));
if (shelf.length) {
  const { error: shelfError } = await supabase.from("shelf").upsert(shelf, { onConflict: "user_id,book_id", ignoreDuplicates: true });
  if (shelfError) throw shelfError;
}
console.log(JSON.stringify({ legacy_user_id: legacyId, auth_user_id: authUserId, shelf_rows: shelf.length }));
