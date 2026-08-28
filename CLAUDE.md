@AGENTS.md

# Kanban+ — คู่มือสถาปัตยกรรมสำหรับ AI agent

เอกสารนี้คือ "ความจริง" ของโปรเจกต์ อ่านก่อนเขียนโค้ดทุกครั้ง
ห้ามคิดสถาปัตยกรรมใหม่เอง ถ้าจะแหวกจากที่เขียนไว้นี้ ให้ถามเจ้าของโปรเจกต์ก่อน

เว็บ Kanban board (แนว Trello) ทำเป็นโปรเจกต์มหาวิทยาลัย — สร้างบอร์ด/ลิสต์/การ์ด
ลากจัดลำดับได้ แชร์บอร์ดให้คนอื่นผ่านลิงก์เชิญ UI เป็นภาษาไทย

---

## Stack

| ส่วน | ใช้อะไร | หมายเหตุ |
|---|---|---|
| Framework | **Next.js 16.3** App Router + Server Actions | Turbopack, React 19.2 |
| ภาษา | TypeScript (strict) | path alias `@/*` ชี้ที่รากโปรเจกต์ |
| UI | React 19 + **Tailwind CSS 4** | ไม่มี component library ทุกอย่างเขียนเอง |
| Database | **PostgreSQL** ผ่าน **Prisma ORM 7** | ต่อผ่าน Neon serverless driver adapter |
| Auth | **NextAuth v5 (Auth.js)** — Credentials + JWT session | ดูหัวข้อ Auth ด้านล่าง |
| แฮชรหัสผ่าน | `bcryptjs` | |
| Validation | **Zod 4** | ใช้ `z.flattenError()` กับฟอร์ม |
| Drag & drop | `@dnd-kit` (core + sortable) | |

**ห้ามเพิ่ม dependency ใหม่โดยไม่ถามก่อน** โดยเฉพาะ state management, component library
หรือ data-fetching library — โปรเจกต์นี้ตั้งใจใช้ Server Components + Server Actions ล้วน
ไม่มี client-side data fetching

---

## Next.js 16 — สิ่งที่ต่างจากที่โมเดลเคยเทรนมา

อ่าน `AGENTS.md` และ `node_modules/next/dist/docs/` ก่อนเสมอ จุดที่พลาดบ่อย:

- **`middleware.ts` ถูกเปลี่ยนชื่อเป็น `proxy.ts`** ไฟล์อยู่ที่รากโปรเจกต์
  export เป็น default function — อย่าสร้าง `middleware.ts` ขึ้นมาใหม่
- Proxy รันบน **Node.js runtime** เป็นค่าเริ่มต้น และตั้ง `runtime` config ไม่ได้ (จะ error)
- Component ที่ใช้ `useSearchParams()` **ต้องมี `<Suspense>` ครอบ** ไม่งั้น `next build`
  พังตอน prerender (ดูตัวอย่างที่ `app/login/page.tsx` กับ `app/signup/page.tsx`)

---

## โครงสร้างโฟลเดอร์

```
auth.ts                       # NextAuth instance หลัก — export { handlers, auth, signIn, signOut }
auth.config.ts                # config ส่วนที่ไม่แตะ DB ใช้ร่วมกันระหว่าง auth.ts กับ proxy.ts
proxy.ts                      # กันหน้าที่ต้องล็อกอิน (เดิมชื่อ middleware.ts)
prisma.config.ts              # config ของ Prisma CLI

app/
  layout.tsx                  # root layout
  page.tsx                    # Dashboard — บอร์ดของฉัน + บอร์ดที่ถูกแชร์มา
  login/page.tsx              # ฟอร์มล็อกอิน (client component + useActionState)
  signup/page.tsx             # ฟอร์มสมัครสมาชิก
  actions/
    auth.ts                   # server actions: signup / login / logout
    board.ts                  # server action: สร้างบอร์ด
  board/[id]/
    page.tsx                  # หน้าบอร์ด (server component ดึงข้อมูลเอง)
    actions.ts                # server actions ของ list/card/label/priority/invite ทั้งหมด
    kanban-board.tsx          # client component — drag & drop ด้วย @dnd-kit
    card-move-buttons.tsx     # ปุ่มย้ายการ์ด (fallback สำหรับคนที่ลากไม่ได้)
    priority-manager.tsx      # จัดการ priority ของบอร์ด
  invite/[token]/             # หน้ารับคำเชิญเข้าบอร์ด + action ตอบรับ
  api/auth/[...nextauth]/     # route handler ของ NextAuth (re-export handlers เฉย ๆ)
  generated/prisma/           # Prisma Client ที่ generate ออกมา — ห้าม commit, ห้ามแก้มือ

lib/
  prisma.ts                   # Prisma Client singleton (กัน hot-reload สร้างซ้ำ)
  dal.ts                      # verifySession() / getCurrentUser() — ประตูเดียวสู่ตัวตนผู้ใช้
  board-access.ts             # assertBoardAccess() — เช็คสิทธิ์ owner/member ของบอร์ด

types/
  next-auth.d.ts              # module augmentation เพิ่ม id เข้าไปใน Session["user"]

prisma/
  schema.prisma               # นิยามโมเดลทั้งหมด
  migrations/                 # ประวัติ migration
  seed.ts                     # ข้อมูลตัวอย่าง (demo@kanban.dev / demopass123)
```

---

## Auth — NextAuth v5 (Credentials + JWT)

**Flow:** ฟอร์ม → Server Action → `signIn("credentials")` → `authorize()` เช็ค bcrypt กับ DB
→ NextAuth เซ็ต JWT ลง cookie `authjs.session-token`

### กฎเหล็ก

1. **อ่านตัวตนผู้ใช้ผ่าน `lib/dal.ts` เท่านั้น** — `getCurrentUser()` หรือ `verifySession()`
   ห้ามเรียก `auth()` ตรง ๆ และห้ามอ่าน cookie เองจากที่อื่น
   ทั้งสองฟังก์ชันห่อด้วย React `cache()` เรียกซ้ำใน request เดียวไม่ query ซ้ำ
   และจะ `redirect("/login")` ให้เองถ้าไม่มี session
2. **`auth.config.ts` ห้าม import Prisma หรือ bcrypt** เพราะ `proxy.ts` ใช้ไฟล์นี้
   ตัว provider ที่แตะ DB ต้องอยู่ใน `auth.ts` เท่านั้น
3. **ใช้ JWT strategy ไม่ใช่ database session** — Credentials provider ของ NextAuth
   รองรับแค่ JWT และ schema นี้ก็ไม่มีตาราง `Account`/`Session`/`VerificationToken`
   (ถ้าจะเพิ่ม OAuth provider ในอนาคต ต้องเพิ่ม 3 ตารางนี้ + `@auth/prisma-adapter` ก่อน)
4. **`trustHost: true` ห้ามลบ** — ไม่งั้น production พัง `UntrustedHost` (ตอน dev ไม่แสดงอาการ)
5. **`signIn()` จัดการ error ไม่สม่ำเสมอ** เรียกจาก Server Action แล้วรหัสผิดจะ **โยน** `AuthError`
   แต่ผ่าน HTTP route จะ **คืน URL ที่ติด `?error=`** — `app/actions/auth.ts` จับไว้ทั้งสองทาง
   และใช้ `redirect: false` เพื่อไม่ให้ NextAuth redirect ทับจน `useActionState` เสีย state
6. ข้อความตอนล็อกอินพลาดต้องเป็น "อีเมลหรือรหัสผ่านไม่ถูกต้อง" เสมอ
   **ห้ามแยกว่าอีเมลผิดหรือรหัสผ่านผิด** เพราะเปิดช่องให้เดาว่ามีอีเมลนี้อยู่ในระบบ

### การกันสิทธิ์ (authorization) — ทำ 2 ชั้น

- **ชั้นนอก (`proxy.ts`)** — เช็คแบบ optimistic อย่างเดียวว่ามี session ไหม
  ไม่มี → เด้งไป `/login?next=<path>` / มีแล้วแต่เข้า `/login` `/signup` → เด้งกลับ `/`
  **ห้ามเอา business logic หรือ query DB มาไว้ในนี้**
- **ชั้นใน (ของจริง)** — ทุก Server Action และทุก page ต้องเช็คเองเสมอ:
  ```ts
  const user = await getCurrentUser();                      // ต้องล็อกอิน
  const access = await assertBoardAccess(boardId, user.id);  // ต้องเป็น owner หรือ member
  if (!access) return;
  ```
  proxy ถูกข้ามได้ ห้ามพึ่งมันเป็นด่านเดียว

### Environment variables

- `DATABASE_URL` — connection string ของ PostgreSQL
- `AUTH_SECRET` — กุญแจเข้ารหัส session JWT (สร้างด้วย `npx auth secret`)
  เปลี่ยนค่านี้ = ผู้ใช้ทุกคนหลุด login

---

## Data model (ดูของจริงที่ `prisma/schema.prisma`)

`User` → `Board` (owner) → `List` → `Card`
เสริมด้วย `BoardMember` (แชร์บอร์ด), `BoardInvite` (เชิญด้วย token),
`Label`, `Priority`, `Checklist`/`ChecklistItem`, `Comment`, `Activity`

จุดที่ต้องรู้:

- **owner ไม่มีแถวใน `BoardMember`** — สิทธิ์เต็มมาจาก `Board.ownerId` ตรง ๆ
  `assertBoardAccess()` เช็ค `ownerId` หรือ membership อย่างใดอย่างหนึ่ง
- **`position` เป็น `Float` ไม่ใช่ `Int`** — เวลาลากแทรกกลางให้คำนวณค่าระหว่างเพื่อนบ้าน
  จะได้ไม่ต้องเขียนลำดับใหม่ทั้งคอลัมน์
- **`Priority` ตั้งเองต่อบอร์ด** (ชื่อ+สีกำหนดได้) การ์ดผูกได้ทีละ 1 priority
- id ทุกตัวเป็น `cuid()`

---

## Convention ของโค้ด

### Server Actions

- ไฟล์ action ขึ้นต้นด้วย `"use server"` ตั้งชื่อลงท้ายด้วย `Action` (เช่น `createListAction`)
- รับ `FormData` เมื่อผูกกับ `<form action={...}>` ตรง ๆ
  หรือรับ argument ปกติเมื่อเรียกจาก client component
- ฟอร์มที่ต้องโชว์ error ให้ใช้ `useActionState` คู่กับ action ที่มี signature
  `(state, formData) => Promise<FormState>` (ดูตัวอย่างที่ `app/actions/auth.ts`)
- **ตรวจ input เองทุกครั้ง** — ค่าจาก `FormData` เป็น `unknown` เช็ค type ก่อนใช้เสมอ
  ไม่ผ่านให้ `return` เงียบ ๆ (action ที่ไม่มี UI error) หรือคืน error state (ฟอร์มที่มี UI)
- แก้ข้อมูลเสร็จต้อง `revalidatePath("/board/<boardId>")` ไม่งั้นหน้าไม่อัปเดต

### Data fetching

- ดึงข้อมูลใน **Server Component** ด้วย `prisma` ตรง ๆ ไม่มี API route ไม่มี `fetch()` ฝั่ง client
  (`app/api/auth/*` เป็นข้อยกเว้นเดียว เพราะ NextAuth ต้องการ)
- client component รับข้อมูลผ่าน props เท่านั้น

### Prisma

- import client จาก `@/app/generated/prisma/client` และ enum จาก `@/app/generated/prisma/enums`
  (**ไม่ใช่** `@prisma/client` — generator ตั้ง output ไว้ที่ `app/generated/prisma`)
- ใช้ `prisma` singleton จาก `@/lib/prisma` เสมอ ห้าม `new PrismaClient()` ที่อื่น
- แก้ schema แล้วต้องรัน `npx prisma migrate dev` (generate client ให้ด้วยในตัว)

### UI

- Tailwind utility ล้วน รองรับ dark mode ด้วย `dark:` ทุกที่ที่มีสี
- ข้อความที่ผู้ใช้เห็น **เป็นภาษาไทย** ส่วนชื่อตัวแปร/ฟังก์ชันเป็นอังกฤษ
- คอมเมนต์เขียนเฉพาะตอนอธิบาย "ทำไม" ไม่ใช่ "ทำอะไร"

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev                  # dev server
npm run build                # production build (เช็คว่า prerender ผ่านไหม)
npm run lint                 # eslint
npx prisma migrate dev       # สร้าง migration + generate client
npx prisma studio            # เปิดดูข้อมูลในฐานข้อมูล
npx tsx prisma/seed.ts       # ใส่ข้อมูลตัวอย่าง
```

**หลังแก้โค้ดทุกครั้งให้รัน `npx tsc --noEmit` และ `npm run build`**
บั๊กหลายตัวของโปรเจกต์นี้ (prerender, UntrustedHost) โผล่เฉพาะตอน build/production เท่านั้น

## หนี้ทางเทคนิคที่รู้อยู่แล้ว

- `app/board/[id]/kanban-board.tsx` มี eslint error `react-hooks/set-state-in-effect`
  (sync props ลง state ผ่าน `useEffect`) — ยังไม่ได้แก้
- `proxy.ts` matcher ไม่ได้ยกเว้น `favicon.ico` เลยมี redirect ไป `/login` เปล่า ๆ อยู่บ้าง
- ยังไม่มี automated test
