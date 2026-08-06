# Kanban+

เว็บแอป Kanban board สำหรับจัดการงาน คล้าย Trello/Notion/GitHub Projects — สร้างด้วย Next.js (App Router) + Prisma + PostgreSQL

**ฟีเจอร์หลัก**
- ระบบสมัครสมาชิก/เข้าสู่ระบบด้วย session cookie ของตัวเอง (ไม่พึ่ง third-party auth)
- สร้างบอร์ดได้หลายบอร์ด เชิญสมาชิกร่วมงานด้วยอีเมล (role: editor/viewer)
- List (คอลัมน์) และ Card เป็น CRUD เต็มรูปแบบ พร้อมลากสลับลำดับได้ทั้งคอลัมน์และการ์ด (dnd-kit)
- ป้ายกำกับ (label) และ priority ที่กำหนดชื่อ/สีเองได้ต่อบอร์ด, assignee, checklist, comment
- บันทึกกิจกรรมของบอร์ด (activity log)

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS 4 |
| Database | PostgreSQL ผ่าน Prisma ORM 7 (แนะนำ [Neon](https://neon.tech) แบบ serverless) |
| Drag & Drop | @dnd-kit |
| Auth | session cookie เซ็นด้วย `jose` + รหัสผ่านแฮชด้วย `bcryptjs` (ดู `lib/session.ts`, `lib/dal.ts`) |

> โปรเจกต์นี้ใช้ Next.js เวอร์ชันที่มี breaking changes จากที่ AI เคยเทรนมา — ถ้าจะแก้โค้ดในนี้ด้วย AI coding agent ให้อ่าน `AGENTS.md` ก่อน

## สิ่งที่ต้องมีก่อนเริ่ม (Prerequisites)

- [Node.js](https://nodejs.org) 20 ขึ้นไป และ npm
- ฐานข้อมูล PostgreSQL 1 ตัว — จะรันในเครื่องเองหรือใช้ฐานข้อมูลฟรีบนคลาวด์อย่าง [Neon](https://neon.tech) ก็ได้ (project นี้ตั้งค่าไว้ให้ใช้กับ Neon โดยตรง)

## เริ่มต้นใช้งาน (Setup)

### 1. Clone โปรเจกต์และติดตั้ง dependencies

```bash
git clone <repository-url>
cd demo-project
npm install
```

### 2. ตั้งค่าตัวแปรสภาพแวดล้อม (Environment Variables)

คัดลอกไฟล์ตัวอย่างแล้วใส่ค่าของคุณเอง:

```bash
cp .env.example .env
```

แล้วแก้ไข `.env` ให้มี 2 ค่านี้:

- `DATABASE_URL` — connection string ของ PostgreSQL (สมัครฟรีที่ [neon.tech](https://neon.tech) หรือรัน `npx create-db` เพื่อสร้างฐานข้อมูล Prisma Postgres ให้อัตโนมัติ)
- `SESSION_SECRET` — ค่าสุ่มสำหรับเซ็น session cookie เช่นสุ่มด้วยคำสั่ง:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

### 3. สร้างตารางในฐานข้อมูล + สร้าง Prisma Client

```bash
npx prisma migrate dev
```

คำสั่งนี้จะสร้างตารางทั้งหมดตาม `prisma/schema.prisma` และ generate Prisma Client ไปที่ `app/generated/prisma` ให้อัตโนมัติ

### 4. ใส่ข้อมูลตัวอย่าง (Seed data)

```bash
npx prisma db seed
```

(ต้องรันเองทุกครั้งที่ต้องการข้อมูลตัวอย่าง — `migrate dev` ไม่ได้ seed ให้อัตโนมัติ) จะได้บอร์ดตัวอย่างชื่อ "Study Plan" พร้อม list/card ตัวอย่าง และบัญชีผู้ใช้สำหรับทดสอบ:

- **อีเมล:** `demo@kanban.dev`
- **รหัสผ่าน:** `demopass123`

### 5. รันเซิร์ฟเวอร์สำหรับพัฒนา

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000) แล้วเข้าสู่ระบบด้วยบัญชีตัวอย่างด้านบน หรือสมัครบัญชีใหม่ได้ที่หน้า `/signup`

## คำสั่งที่ใช้บ่อย (Scripts)

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | รันเซิร์ฟเวอร์สำหรับพัฒนา (Turbopack) |
| `npm run build` | build โปรเจกต์สำหรับ production |
| `npm run start` | รันเซิร์ฟเวอร์ production (ต้อง build ก่อน) |
| `npm run lint` | ตรวจโค้ดด้วย ESLint |
| `npx prisma studio` | เปิดหน้าต่างดู/แก้ข้อมูลในฐานข้อมูลผ่าน GUI |
| `npx prisma migrate dev --name <ชื่อ>` | สร้าง migration ใหม่หลังแก้ `schema.prisma` |
| `npx prisma generate` | generate Prisma Client ใหม่ (ปกติรันอัตโนมัติหลัง migrate) |

## โครงสร้างโปรเจกต์ (คร่าวๆ)

```
app/
  actions/         # server actions ที่ใช้ข้ามหลายหน้า (auth, สร้างบอร์ด)
  board/[id]/       # หน้าบอร์ดเดี่ยว + server actions ของ list/card/label/priority
  login/ signup/    # หน้าล็อกอิน/สมัครสมาชิก
  invite/           # หน้ารับคำเชิญเข้าร่วมบอร์ด
  generated/prisma/ # Prisma Client ที่ generate ไว้ (ห้าม commit, อยู่ใน .gitignore)
lib/
  session.ts        # เซ็น/ตรวจ session cookie
  dal.ts             # ดึงข้อมูล user ปัจจุบันจาก session
  board-access.ts    # ตรวจสิทธิ์เข้าถึงบอร์ด (owner/member)
  prisma.ts           # Prisma Client instance
prisma/
  schema.prisma      # นิยามโมเดลฐานข้อมูลทั้งหมด
  migrations/         # ประวัติ migration
  seed.ts              # สคริปต์ใส่ข้อมูลตัวอย่าง
```

## Deploy

โปรเจกต์นี้ deploy ขึ้น [Vercel](https://vercel.com) ได้ตรงๆ (เข้ากันได้ดีกับ Next.js) — อย่าลืมตั้งค่า `DATABASE_URL` และ `SESSION_SECRET` เป็น environment variables บนแพลตฟอร์มที่ deploy ด้วย
