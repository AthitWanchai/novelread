# เชื่อม Novelread กับ Supabase

โค้ดรองรับ Supabase Auth, Postgres และ Storage แล้ว เมื่อมี `SUPABASE_URL`, `SUPABASE_ANON_KEY` และ `SUPABASE_SERVICE_ROLE_KEY` ครบ API จะใช้ cloud; หากไม่มีจะใช้ SQLite เดิม

## ตั้งค่าโปรเจกต์

1. สร้าง Supabase project แล้วรัน migration ใน SQL Editor ตามลำดับ:
   - `supabase/migrations/202610170001_initial.sql` (โครงสร้างหลัก, RLS, trigger ผู้ใช้ใหม่ และ Storage bucket)
   - `supabase/migrations/202610170002_roles.sql` (ระบบบทบาท `admin`, นโยบายความปลอดภัย และสิทธิ์ของผู้ดูแล)
   *(จำเป็นต้องรันทั้งสองไฟล์ก่อนเปิดเว็บ เนื่องจากโค้ด API เรียกใช้ฟิลด์ `profiles.role` ตั้งแต่การเข้าสู่ระบบ)*
2. เปิด **Confirm email** ใน Authentication และกำหนด Site URL/Redirect URLs ให้ตรงกับโดเมนที่จะใช้ รวม `http://localhost:3000/account` ระหว่างพัฒนา
3. ตั้งค่า `web/.env.local` ในเครื่อง (Next.js ใช้ `web/` เป็น project root) และ environment variables ในโฮสต์:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

เก็บ service role key ฝั่งเซิร์ฟเวอร์เท่านั้น อย่าใส่ `NEXT_PUBLIC_` หรือ commit ลง Git แล้วรัน `npm install` และ `npm run dev`

## บทบาทผู้ใช้และผู้ดูแล

การสมัครบัญชีใหม่จะได้ role `user` โดยอัตโนมัติจากค่าเริ่มต้นของคอลัมน์ หากต้องการตั้งผู้ดูแลคนแรก ให้ผู้ใช้นั้นสมัครและยืนยันอีเมลก่อน แล้วรันคำสั่งกำหนด role จาก SQL Editor ของ Supabase:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where lower(email) = lower('อีเมลที่สมัคร')
);
```

หลังจากมีผู้ดูแลแล้ว บัญชีแอดมินเรียก API `GET /api/library/admin/users` เพื่อดูบัญชี และ `PUT /api/library/admin/users/{user-id}/role` พร้อม body `{"role":"admin"}` หรือ `{"role":"user"}` เพื่อจัดการ role ได้ โดยในระดับฐานข้อมูลได้จำกัด `grant update (name) on public.profiles to authenticated` เพื่อป้องกันไม่ให้ผู้ใช้ทั่วไป (หรือใครก็ตามผ่าน Supabase client ฝั่งหน้าบ้าน) แก้ไข role ของตัวเองได้โดยตรง การเปลี่ยน role จึงต้องผ่าน Admin API (ซึ่งใช้ `SUPABASE_SERVICE_ROLE_KEY`) หรือ SQL Editor เท่านั้น

## ย้ายข้อมูลเดิม

```powershell
node scripts/export-sqlite.mjs
node scripts/import-supabase.mjs data/supabase-import.json
```

ตั้ง `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` ใน environment ของ terminal ที่รัน import ก่อน คำสั่ง export สร้าง `data/supabase-import.json` ที่มีอีเมลและเนื้อหา จึงต้องเก็บเป็นข้อมูลส่วนตัว สคริปต์ไม่แก้ SQLite เดิม การนำเข้าเก็บหนังสือ/ตอนโดยคง ID เดิม และยังไม่กำหนดเจ้าของ cloud ให้หนังสือเดิม ข้อมูลที่ส่งออกจากเครื่องนี้ล่าสุดมี 3 บัญชี 9 เรื่อง และ 21 ตอน; ตรวจให้แน่ใจว่านี่คือชุดที่ต้องการย้ายก่อนรัน import

หลังเจ้าของเดิมสมัครบัญชี Supabase และ **ยืนยันอีเมลแล้ว** ผู้ดูแลใช้ UUID ของ Auth user เพื่อผูกผลงานและชั้นหนังสือ:

```powershell
node scripts/claim-legacy-author.mjs data/supabase-import.json <legacy-user-id> <auth-user-uuid>
```

สคริปต์ตรวจว่าอีเมลที่ยืนยันตรงกับบัญชีเดิมก่อนผูกข้อมูล รหัสผ่าน SQLite เดิมไม่ถูกย้าย โปรไฟล์นักเขียนเก่าจะแสดงผ่าน `legacy_owner_id` จนกว่าจะผูกเจ้าของ

ย้ายรูปปกใน `data/covers` หลังนำเข้าเรื่อง/ตอน:

```powershell
node scripts/import-covers.mjs data/supabase-import.json data/covers
```

สคริปต์อัปโหลดปกเดิมและแก้ `books.cover` เป็น public URL ของ Storage ส่วนลิงก์รูปปกภายนอกใช้ต่อได้

## ก่อนเปิดใช้จริง

ตรวจสมัครและเข้าสู่ระบบจากสองบัญชี, การอ่านตอนเผยแพร่, การเข้าถึงร่างเฉพาะเจ้าของ, การอัปโหลดปก, และการกู้ข้อมูลจาก backup บน Supabase project จริง โหมดนี้ยังไม่มีระบบเหรียญหรือชำระเงินตามแผนเปิดตัว
