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
  layout.tsx                  # root layout (ฟอนต์ Geist + Noto Sans Thai, ครอบทุกหน้า)
  globals.css                 # design token ทั้งระบบ (ดูหัวข้อ UI ด้านล่าง)
  login/page.tsx              # ฟอร์มล็อกอิน (client component + useActionState)
  signup/page.tsx             # ฟอร์มสมัครสมาชิก
  invite/[token]/             # หน้ารับคำเชิญเข้าบอร์ด + action ตอบรับ
  api/auth/[...nextauth]/     # route handler ของ NextAuth (re-export handlers เฉย ๆ)
  actions/
    auth.ts                   # server actions: signup / login / logout
    board.ts                  # server actions: สร้าง/แก้ไขบอร์ด (แก้ได้เฉพาะเจ้าของ)

  (app)/                      # route group ของหน้าที่ต้องล็อกอิน — ไม่เปลี่ยน URL
    layout.tsx                # โครงแอป: Sidebar + Topbar + <main>
    page.tsx                  # Dashboard                    → "/"
    search/page.tsx           # ผลการค้นหาข้ามบอร์ด (?q=)     → "/search"
    calendar/page.tsx         # ปฏิทินกำหนดส่ง (?m=, ?board=) → "/calendar"
    board/[id]/
      page.tsx                # หน้าบอร์ด (server component ดึงข้อมูลเอง)
      actions.ts              # server actions ของ list/card/label/priority/invite ทั้งหมด
      types.ts                # ListWithCards / CardWithRelations ใช้ร่วมกันทั้งโฟลเดอร์
      kanban-board.tsx        # client — drag & drop (@dnd-kit) + ฟิลเตอร์ + คุมว่าเปิดการ์ดไหน
      board-card.tsx          # client — การ์ดแบบกระชับบนคอลัมน์
      card-detail-dialog.tsx  # client — modal รายละเอียดการ์ด (แก้ทุกอย่างที่นี่)
      card-create-dialog.tsx  # client — modal เพิ่มการ์ด (ชื่อ/รายละเอียด/กำหนดส่ง/priority)
      list-dialog.tsx         # client — modal สร้าง+แก้ไขคอลัมน์ (ชื่อ/สี/คำอธิบาย)
      board-settings-dialog.tsx # client — modal ตั้งค่าบอร์ด (label / priority / เชิญสมาชิก)
      board-filters.tsx       # client — แถบฟิลเตอร์ (กรองฝั่ง client ล้วน)
      list-menu.tsx           # client — เมนู ⋯ ของคอลัมน์
      card-move-buttons.tsx   # ปุ่มย้ายการ์ด (fallback ของการลาก อยู่ใน modal)
      priority-manager.tsx    # จัดการ priority ของบอร์ด (อยู่ใน modal ตั้งค่า)

  components/
    ui/                       # primitive ใช้ซ้ำ: panel, stat-tile, chip, avatar,
                              # progress-ring, bar-chart, modal, buttons, toast, icons,
                              # color-picker (จานสีกลาง ใช้ทั้งบอร์ดและคอลัมน์)
    app-shell/                # sidebar, topbar, nav-link, mobile-nav,
                              # create-board-dialog
    dashboard/                # game-stats, due-cards, task-row, overview-panel,
                              # weekly-chart, month-progress, board-cards
  generated/prisma/           # Prisma Client ที่ generate ออกมา — ห้าม commit, ห้ามแก้มือ

lib/
  prisma.ts                   # Prisma Client singleton (กัน hot-reload สร้างซ้ำ)
  dal.ts                      # verifySession() / getCurrentUser() — ประตูเดียวสู่ตัวตนผู้ใช้
  board-access.ts             # assertBoardAccess() — เช็คสิทธิ์ owner/member ของบอร์ด
  boards.ts                   # accessibleBoardWhere() + getUserBoards() + boardColor()
  dashboard.ts                # ตัวเลข/กราฟของ dashboard (query อ่านอย่างเดียว)
  due.ts                      # เทียบวันกำหนดส่งด้วย "คีย์วันที่" ตามเวลาไทย + สีของแต่ละกลุ่ม
  points.ts                   # กติกาแต้ม/เลเวล/สตรีค (คณิตศาสตร์ล้วน ไม่แตะ DB → มี unit test)
  gamification.ts             # อ่าน-เขียน ledger ของ PointEvent + re-export ค่าจาก points.ts

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
  const user = await getCurrentUser();                       // ต้องล็อกอิน
  const access = await assertBoardAccess(boardId, user.id);  // ต้องเป็น owner หรือ member
  if (!access?.canEdit) return;   // action ที่แก้ข้อมูล
  if (!access) notFound();        // page ที่แค่อ่าน (viewer เข้าได้)
  ```
  proxy ถูกข้ามได้ ห้ามพึ่งมันเป็นด่านเดียว

### สิทธิ์ในบอร์ด (`BoardRole`)

`assertBoardAccess()` คืน `{ id, ownerId, role, isOwner, canEdit }` มาให้เลย
**ห้ามให้ action ไปตีความ role เอง** ใช้ `canEdit` ที่มันคำนวณมาแล้ว

| | ดูบอร์ด | แก้การ์ด/คอลัมน์/ป้าย/priority | คอมเมนต์ | เชิญสมาชิก |
|---|---|---|---|---|
| OWNER (`Board.ownerId`) | ✓ | ✓ | ✓ | ✓ |
| EDITOR (`BoardMember.role`) | ✓ | ✓ | ✓ | ✗ |
| VIEWER (`BoardMember.role`) | ✓ | ✗ | ✗ | ✗ |

- **action ที่แก้ข้อมูลต้องเช็ค `access.canEdit` ไม่ใช่แค่ `access` ไม่เป็น null**
  เขียนใหม่แล้วลืมบรรทัดนี้ = viewer แก้ข้อมูลได้
- role มาตอนเชิญ (`createInviteAction` → `BoardInvite.role` → `BoardMember.role`)
  ค่าที่ไม่รู้จักตกเป็น `EDITOR` เท่ากับ default เดิมของ schema
- ฝั่ง UI รับ prop `canEdit` ไล่ลงจาก `board/[id]/page.tsx` เพื่อ**ซ่อนปุ่มที่กดไม่ได้**
  — เป็นแค่เรื่อง UX เท่านั้น client component ถูกข้ามได้เสมอ ด่านจริงคือฝั่ง action

### Environment variables

- `DATABASE_URL` — connection string ของ PostgreSQL
- `AUTH_SECRET` — กุญแจเข้ารหัส session JWT (สร้างด้วย `npx auth secret`)
  เปลี่ยนค่านี้ = ผู้ใช้ทุกคนหลุด login

---

## Data model (ดูของจริงที่ `prisma/schema.prisma`)

`User` → `Board` (owner) → `List` → `Card`
เสริมด้วย `BoardMember` (แชร์บอร์ด), `BoardInvite` (เชิญด้วย token),
`Label`, `Priority`, `Checklist`/`ChecklistItem`, `Comment`, `Activity`, `PointEvent` (ledger แต้ม)

จุดที่ต้องรู้:

- **owner ไม่มีแถวใน `BoardMember`** — สิทธิ์เต็มมาจาก `Board.ownerId` ตรง ๆ
  `assertBoardAccess()` เช็ค `ownerId` หรือ membership อย่างใดอย่างหนึ่ง
- **`position` เป็น `Float` ไม่ใช่ `Int`** — เวลาลากแทรกกลางให้คำนวณค่าระหว่างเพื่อนบ้าน
  จะได้ไม่ต้องเขียนลำดับใหม่ทั้งคอลัมน์
- **`Priority` ตั้งเองต่อบอร์ด** (ชื่อ+สีกำหนดได้) การ์ดผูกได้ทีละ 1 priority
- **`List.isDoneList`** — คอลัมน์ "เสร็จสิ้น" ของบอร์ด มีได้บอร์ดละ 1 คอลัมน์
  (`setDoneListAction` ล้างธงเดิมก่อนตั้งใหม่เสมอ)
- **`List.color` / `List.description`** ผู้ใช้ตั้งเองต่อคอลัมน์ (nullable ทั้งคู่)
  คอลัมน์เก่าที่ยังไม่มีสีจะ fallback ไปใช้สีตามลำดับคอลัมน์ (`LIST_ACCENTS`)
- **`Card.isCompleted` = สถานะตอนนี้ / `Card.completedAt` = เคยเสร็จหรือยัง**
  ลากออกจากคอลัมน์เสร็จสิ้นจะเซ็ต `isCompleted = false` แต่ **ห้ามล้าง `completedAt`**
- id ทุกตัวเป็น `cuid()`

---

## Gamification + กำหนดส่ง

**กติกาแต้ม (อยู่ที่ `lib/gamification.ts` ที่เดียว):** ทำการ์ดเสร็จ +10, ส่งทันกำหนด +5,
ส่งช้าไม่หักแต้ม เลเวลคำนวณจากแต้มสะสม สตรีคนับจากวันที่มี `PointEvent` ติดต่อกัน (เวลาไทย)

- **`PointEvent` คือแหล่งความจริงเดียว ไม่มีตาราง cache ยอดรวม** — แต้ม/เลเวล/สตรีค
  คำนวณสดจาก ledger ทุกครั้งที่ render
- **`@@unique([cardId, type])` คือกลไกกันฟาร์มแต้ม** การ์ด 1 ใบให้แต้มแต่ละชนิดได้ครั้งเดียว
  ตลอดชีพ ลากเข้า-ออก-เข้าคอลัมน์เสร็จสิ้นกี่รอบก็ไม่ได้แต้มเพิ่ม
  **จึงไม่ต้องล็อกการ์ดที่เสร็จแล้ว** (ล็อกจะขัดกับธรรมชาติของ kanban)
  การ์ดที่เคยได้แต้มแล้วถูกลากออกจะขึ้นชิป "ได้แต้มแล้ว"
- **แต้มได้แล้วไม่ริบคืน** ลากออกจากคอลัมน์เสร็จสิ้นไม่ลบ `PointEvent` และไม่ล้าง `completedAt`
- ตรรกะทั้งหมดรวมอยู่ที่ `syncCardCompletion()` ใน `app/board/[id]/actions.ts`
  ซึ่งถูกเรียกจาก `moveCardAction` กับ `reorderCardAction` — ถ้าจะเพิ่มทางเข้าใหม่
  (เช่น ปุ่มติ๊กเสร็จ) ให้เรียกฟังก์ชันนี้ ห้ามเขียนกติกาแต้มซ้ำที่อื่น
- action ที่ให้แต้มต้อง `revalidatePath("/")` ด้วย ไม่งั้นแถบโปรไฟล์บน dashboard ไม่อัปเดต

**นิยามของกลุ่มกำหนดส่งมีที่เดียวคือ `dueBucket()` ใน `lib/due.ts`**
(`overdue` / `today` / `soon` = พรุ่งนี้ถึงอีก 7 วัน / `later`) ที่ไหนจะนับเลขของกลุ่มไหน
ต้องอิงช่วงเดียวกัน และดึงป้ายชื่อจาก `DUE_BUCKET_STYLE[bucket].title`
ไม่ใช่ฮาร์ดโค้ดคำว่า "ภายใน 7 วัน" ซ้ำ — เคยหลุดคู่กันมาแล้วระหว่าง dashboard กับหน้ารายการ

**วันกำหนดส่ง:** `Card.dueDate` เก็บเป็นเที่ยงคืน UTC (มาจาก `<input type="date">`)
**ห้ามเทียบกับ `Date.now()` ตรง ๆ** เพราะไทยเป็น UTC+7 แล้วจะเพี้ยนข้ามวัน —
ให้ใช้ `dateKey()` / `dueBucket()` / `isOnTime()` จาก `lib/due.ts` เท่านั้น

---

## UI / ธีม (สำคัญ)

หน้าตาทั้งระบบอิงดีไซน์อ้างอิงแนว dashboard โทนมืด — **สีทุกจุดมาจาก token ใน `app/globals.css`**

- token ที่ใช้ได้: `surface` (พื้นหน้า) `panel` (การ์ด) `panel-2` (ชั้นยกขึ้น/ช่องกรอก)
  `line` (เส้นขอบ) `text` `muted` `accent` `warn` `danger` `info` (+ `*-ink` สำหรับตัวอักษรบนพื้นสีนั้น)
  เขียนเป็น utility ปกติ เช่น `bg-panel border-line text-muted`
- **ห้ามฮาร์ดโค้ด `zinc-*` / `bg-white` / `text-black` หรือเขียน `dark:` เพิ่ม** — token สลับ
  light/dark ให้เองผ่าน `prefers-color-scheme` ถ้าต้องการสีใหม่ให้เพิ่ม token ก่อน
  ข้อยกเว้นเดียวคือสีที่ผู้ใช้ตั้งเองใน DB (`label.color`, `priority.color`) ให้ใส่ผ่าน `style`
- ห้ามเพิ่มไลบรารี UI/กราฟ: กราฟใช้ `components/ui/bar-chart.tsx` กับ `progress-ring.tsx` (SVG/CSS ล้วน)
  modal ใช้ `components/ui/modal.tsx` ที่ครอบ `<dialog>` ของเบราว์เซอร์ (ได้ Esc + focus trap ฟรี)
- ปุ่มที่ยิง Server Action ให้ใช้ `SubmitButton` (มี pending state) และปุ่มลบให้ใช้
  `ConfirmSubmitButton` (กดสองจังหวะ) จาก `components/ui/buttons.tsx` — **ห้ามใช้ `window.confirm`**
- ไอคอนทั้งหมดอยู่ที่ `components/ui/icons.tsx`
  **ห้ามตั้งชื่อไฟล์ว่า `icon.tsx` ในโฟลเดอร์ `app/`** เพราะ Next จะมองว่าเป็น metadata route
  แล้ว build พังด้วย "Default export is missing"
- ตัวอักษรไทยมาจาก `Noto_Sans_Thai` (`next/font/google`) ที่ต่อท้าย Geist ใน `--font-sans`

### หน้าบอร์ด

- การ์ดบนคอลัมน์โชว์แค่ข้อมูลสรุป (ชื่อ/กำหนดส่ง/priority/ผู้รับผิดชอบ/ความคืบหน้า checklist)
  **การแก้ไขทุกอย่างอยู่ใน `card-detail-dialog.tsx`** อย่าเอาฟอร์มกลับไปแปะบนการ์ดอีก
- **การสร้าง/แก้ไขบอร์ด คอลัมน์ และการ์ด ทำผ่าน modal ทั้งหมด ห้ามเอาช่องกรอก inline กลับมา**
  สร้างบอร์ด → `app-shell/create-board-dialog.tsx` / แก้บอร์ด → หัวข้อ "ข้อมูลบอร์ด"
  ใน `board-settings-dialog.tsx` (เห็นเฉพาะเจ้าของ)
  เพิ่มคอลัมน์/กดที่ชื่อคอลัมน์ → `list-dialog.tsx` (ตัวเดียวกัน ส่ง prop `list` = โหมดแก้ไข)
  เพิ่มการ์ด → `card-create-dialog.tsx`
  สีที่ผู้ใช้ตั้งเองใช้ `ColorPicker` จาก `components/ui/color-picker.tsx` เสมอ
  **อย่าก๊อปจานสีไปไว้ที่อื่น** — เคยมีสองชุดแล้วเสี่ยงเพี้ยนออกจากกัน
- `create-board-dialog.tsx` ปิดตัวเองด้วยการดู `usePathname()` เปลี่ยน ไม่ใช่รอ action คืนค่า
  เพราะ `createBoardAction` จบด้วย `redirect()` ซึ่งโยน `NEXT_REDIRECT` โค้ดหลัง `await` จึงไม่ทำงาน
  และ Sidebar อยู่ใน layout เลยไม่ถูก unmount ตอนเปลี่ยนหน้า
- ปุ่มใน Sidebar ที่เปิด modal ต้อง `event.stopPropagation()` เพราะ `mobile-nav.tsx`
  ปิด drawer เมื่อคลิกอะไรก็ตามข้างใน ถ้าปล่อยให้ลอยขึ้นไป modal จะกะพริบหายทันทีที่เปิด
- **คอลัมน์สูงเท่ากันเต็มจอ** (`h-[calc(100vh-20rem)]` ที่ตัวครอบ + `h-full` ที่คอลัมน์)
  การ์ดเลื่อนอยู่ในคอลัมน์ ปุ่ม "เพิ่มการ์ด" ติดล่างคอลัมน์เสมอ
  ที่ทำแบบนี้เพื่อให้บอร์ดกินจอแรกทั้งหมด แล้วแผง "กิจกรรมล่าสุด" ตกไปอยู่ใต้ fold
- ใน `card-detail-dialog.tsx` ปุ่ม "บันทึก" กับ "ลบการ์ดนี้" อยู่ที่ footer ด้วยกัน
  `<form>` ซ้อนกันไม่ได้ ช่องกรอกฝั่งซ้ายจึงผูกกับฟอร์มบันทึกด้วย attribute `form={editFormId}`
  — **ย้ายช่องกรอกแล้วอย่าลืม `form` attribute** ไม่งั้นค่าจะไม่ถูกส่งไปกับ action
- ฟิลเตอร์กรองฝั่ง client จาก props ที่มีอยู่ (ไม่ยิง DB เพิ่ม) และ **ต้องปิดการลากระหว่างกรอง**
  เพราะตำแหน่งใหม่คำนวณจากการ์ดเพื่อนบ้าน ถ้าบางใบถูกซ่อนตำแหน่งจะเพี้ยน
- คำสั่งของคอลัมน์ (เปลี่ยนชื่อ / ตั้งเป็นคอลัมน์เสร็จสิ้น / ลบ) อยู่ในเมนู ⋯ ที่ `list-menu.tsx`

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
npm test                     # unit test (Node test runner ผ่าน tsx ไม่มี framework เพิ่ม)
npx prisma migrate dev       # สร้าง migration + generate client
npx prisma studio            # เปิดดูข้อมูลในฐานข้อมูล
npx tsx prisma/seed.ts       # ใส่ข้อมูลตัวอย่าง
```

**หลังแก้โค้ดทุกครั้งให้รัน `npx tsc --noEmit` และ `npm run build`**
บั๊กหลายตัวของโปรเจกต์นี้ (prerender, UntrustedHost) โผล่เฉพาะตอน build/production เท่านั้น

## หนี้ทางเทคนิคที่รู้อยู่แล้ว

- (แก้แล้ว) `kanban-board.tsx` เลิกใช้ `useEffect` sync props แล้ว เปลี่ยนไปเซ็ต state
  ระหว่าง render ตามแพตเทิร์นที่ React แนะนำ — `npm run lint` ตอนนี้ผ่านสะอาด ห้ามทำให้พังอีก
- test ครอบเฉพาะฟังก์ชันบริสุทธิ์ (`lib/due.ts`, `lib/points.ts`) ยังไม่มี integration test
  ที่แตะ DB หรือ Server Action — ตรรกะสิทธิ์ (`canEdit`) จึงยังต้องทดสอบด้วยมือ
- ลบการ์ดที่เคยได้แต้มแล้วสร้างใหม่ = ได้แต้มอีกรอบ (cuid เปลี่ยน) — ช่องโหว่ที่ยอมรับได้
- ตอนตั้งคอลัมน์เสร็จสิ้น การ์ดที่อยู่ในคอลัมน์นั้นอยู่แล้วจะถูกมาร์กว่าเสร็จ แต่ไม่ได้แต้มย้อนหลัง
  (ไม่รู้ว่าใครเป็นคนทำ) และ `prisma/seed.ts` ใช้ `update: {}` จึงไม่เติม `dueDate`
  ให้การ์ด seed ที่มีอยู่ก่อนแล้ว
