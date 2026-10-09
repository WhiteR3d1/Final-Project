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
| ไฟล์แนบ | `@vercel/blob` | เก็บไฟล์ที่ผู้ใช้อัปโหลดในการ์ด ต้องมี `BLOB_READ_WRITE_TOKEN` |

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
vercel.json                   # regions: ["sin1"] — function รันที่สิงคโปร์ข้าง Neon (ดูหัวข้อ Deploy / ความเร็ว)

app/
  layout.tsx                  # root layout (ฟอนต์ Geist + Noto Sans Thai, ครอบทุกหน้า)
  globals.css                 # design token ทั้งระบบ (ดูหัวข้อ UI ด้านล่าง)
  login/page.tsx              # ฟอร์มล็อกอิน (client component + useActionState)
  signup/page.tsx             # ฟอร์มสมัครสมาชิก
  invite/[token]/             # หน้ารับคำเชิญ — รับได้ทั้ง BoardInvite (รายอีเมล)
                              # และ BoardShareLink (ลิงก์ทั่วไป) ผ่าน path เดียวกัน
  api/auth/[...nextauth]/     # route handler ของ NextAuth (re-export handlers เฉย ๆ)
  actions/
    auth.ts                   # server actions: signup / login / logout
    board.ts                  # server actions: สร้าง/แก้ไข/ลบบอร์ด (แก้/ลบได้เฉพาะเจ้าของ)
  suspended/page.tsx          # ปลายทางของบัญชีที่ถูกระงับ — อยู่นอก (app) และใช้ getSessionUser() กันวนลูป

  (app)/                      # route group ของหน้าที่ต้องล็อกอิน — ไม่เปลี่ยน URL
    layout.tsx                # โครงแอป: Sidebar + Topbar + <main>
    loading.tsx               # skeleton ระหว่างรอ render (board/[id]/loading.tsx มีของตัวเอง)
    page.tsx                  # Dashboard                    → "/"
    search/page.tsx           # ผลการค้นหาข้ามบอร์ด (?q=)     → "/search"
    calendar/page.tsx         # ปฏิทินกำหนดส่ง (?m=, ?board=) → "/calendar"
    account/                  # บัญชีของฉัน: เปลี่ยนรหัสผ่าน (รู้รหัสเดิม) → "/account"
    admin/                    # จัดการผู้ใช้ (แอดมินเท่านั้น): role / ระงับ / ตั้งรหัสใหม่ → "/admin"
    courses/                  # รายวิชาของอาจารย์ → "/courses", "/courses/[id]"
      actions.ts              # สร้าง/ลบวิชา, สุ่มรหัสใหม่, ถอนบอร์ดออก, exportCourseScoresAction (CSV)
      [id]/csv-download-button.tsx # client — รับ string จาก action แล้วสร้างไฟล์ดาวน์โหลดเอง
    my-reviews/               # ผลตรวจของงานฉัน + เคลียร์ตัวเลขแจ้งเตือน → "/my-reviews"
    review/                   # หน้าตรวจงานของอาจารย์ (?tab=pending|done, ?course=, ?board=) → "/review"
      page.tsx                # การ์ดในคอลัมน์ตรวจของบอร์ดในวิชาตัวเอง — ไม่ใช่อาจารย์ = notFound()
      actions.ts              # reviewCardAction: อนุมัติ (คะแนน + ย้ายเข้าเสร็จสิ้น) / ส่งกลับแก้ไข
      review-form.tsx         # client — ช่องคะแนน/ความเห็น (controlled) + ปุ่มสองปุ่มแยกด้วย name="intent"
      reviewed-panel.tsx      # client — แท็บ "ตรวจแล้ว": สรุป ✓ ตรวจแล้ว แทนฟอร์ม กด "แก้ไขผลตรวจ" ถึงเปิดฟอร์ม
    board/[id]/
      page.tsx                # หน้าบอร์ด (server component ดึงข้อมูลเอง)
      actions.ts              # server actions ของ list/card/label/priority/invite/
                              # ไฟล์แนบ/ลิงก์แชร์ ทั้งหมด
      types.ts                # ListWithCards / CardWithRelations / publicUserSelect / PublicUser
      kanban-board.tsx        # client — drag & drop (@dnd-kit) + ฟิลเตอร์ + คุมว่าเปิดการ์ดไหน
      board-card.tsx          # client — การ์ดแบบกระชับบนคอลัมน์
      card-detail-dialog.tsx  # client — modal รายละเอียดการ์ด (แก้ทุกอย่างที่นี่)
      card-create-dialog.tsx  # client — modal เพิ่มการ์ดพร้อมป้าย/ผู้รับผิดชอบ/เช็กลิสต์/ไฟล์/ความคิดเห็น
      attachment-upload.tsx   # client — คิวอัปโหลดหลายไฟล์ + ภาพตัวอย่าง + ลองใหม่รายไฟล์
      list-dialog.tsx         # client — modal สร้าง+แก้ไขคอลัมน์ (ชื่อ/สี/คำอธิบาย)
      board-settings-dialog.tsx # client — modal ตั้งค่าบอร์ด (ข้อมูลบอร์ด / label / priority / เชิญสมาชิก)
      share-link-box.tsx      # client — ลิงก์แชร์ "ใครมีลิงก์ก็เข้าได้" (อยู่ใน modal ตั้งค่า เห็นเฉพาะเจ้าของ)
      card-attachments.tsx    # client — ไฟล์แนบของการ์ด (อยู่ใน modal รายละเอียดการ์ด)
      card-field-selects.tsx  # client — dropdown ของ priority / ป้ายกำกับ / ผู้รับผิดชอบ (อยู่ใน modal การ์ด)
      board-filters.tsx       # client — แถบฟิลเตอร์ (กรองฝั่ง client ล้วน)
      list-menu.tsx           # client — เมนู ⋯ ของคอลัมน์
      card-move-buttons.tsx   # ปุ่มย้ายการ์ด (fallback ของการลาก อยู่ใน modal)
      card-review-result.tsx  # ผลตรวจของอาจารย์ (ReviewChip บนการ์ด / CardReviewResult ใน modal และหน้าตรวจงาน)
      priority-manager.tsx    # จัดการ priority ของบอร์ด (อยู่ใน modal ตั้งค่า)

  components/
    ui/                       # primitive ใช้ซ้ำ: panel, stat-tile, chip, avatar,
                              # progress-ring, bar-chart, modal, select-menu, buttons, toast, icons,
                              # color-picker (จานสีกลาง ใช้ทั้งบอร์ดและคอลัมน์)
    app-shell/                # sidebar, topbar, nav-link, mobile-nav,
                              # create-board-dialog
    dashboard/                # game-stats, due-cards, task-row, overview-panel,
                              # weekly-chart, month-progress, board-cards, leaderboard
  generated/prisma/           # Prisma Client ที่ generate ออกมา — ห้าม commit, ห้ามแก้มือ

lib/
  prisma.ts                   # Prisma Client singleton (กัน hot-reload สร้างซ้ำ)
  dal.ts                      # verifySession() / getCurrentUser() (+ role จริง, ด่านบัญชีถูกระงับ)
  board-access.ts             # assertBoardAccess() — เช็คสิทธิ์ owner/member/อาจารย์ ของบอร์ด
  roles.ts                    # effectiveRole() / canTeach() / canManageUsers() + ADMIN_EMAILS (มี unit test)
  notifications.ts            # ตัวเลขบน sidebar (งานรอตรวจ / ผลตรวจที่ยังไม่อ่าน) ห่อ cache()
  leaderboard.ts              # อันดับเพื่อนร่วมรายวิชาบนหน้าแรก (getMyCourses / getCourseLeaderboard)
  password.ts                 # newPasswordSchema — กติการหัสผ่านเดียวกันทั้งสมัคร/เปลี่ยน/แอดมินตั้ง
  join-code.ts                # สุ่มรหัสเข้าร่วมรายวิชา (ฟังก์ชันบริสุทธิ์ → มี unit test)
  csv.ts                      # toCsv() + BOM + กัน formula injection (ฟังก์ชันบริสุทธิ์ → มี unit test)
  card-completion.ts          # syncCardCompletion() — ทางเข้าเดียวของกติกา "เสร็จ" + แต้ม
  drag.ts                     # ตำแหน่งตอนลาก/แทรกคอลัมน์ + isDoneListName() (ฟังก์ชันบริสุทธิ์ → มี unit test)
  boards.ts                   # accessibleBoardWhere() + getUserBoards() + boardColor()
  dashboard.ts                # ตัวเลข/กราฟของ dashboard (query อ่านอย่างเดียว)
  due.ts                      # เทียบวันกำหนดส่งด้วย "คีย์วันที่" ตามเวลาไทย + สีของแต่ละกลุ่ม
  points.ts                   # กติกาแต้ม/เลเวล/สตรีค (คณิตศาสตร์ล้วน ไม่แตะ DB → มี unit test)
  attachments.ts              # กติกาไฟล์แนบ: ตรวจ URL / เดาชนิด / ขนาด (ฟังก์ชันบริสุทธิ์ → มี unit test)
  gamification.ts             # อ่าน-เขียน ledger ของ PointEvent + re-export ค่าจาก points.ts

types/
  next-auth.d.ts              # module augmentation เพิ่ม id เข้าไปใน Session["user"]

prisma/
  schema.prisma               # นิยามโมเดลทั้งหมด
  migrations/                 # ประวัติ migration
  seed.ts                     # ข้อมูลตัวอย่าง: นักศึกษา demo@ / อาจารย์ teacher@ / แอดมิน admin@kanban.dev
                              # + รายวิชา "วิชาตัวอย่าง" รหัส KANBAN ที่ผูกบอร์ด Study Plan
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
   - `getCurrentUser()` คืน `role` ที่คำนวณแล้ว (รวม `ADMIN_EMAILS`) — **ห้ามอ่าน `user.role` จาก DB ตรง ๆ
     และห้ามเก็บ role ใน JWT** (เปลี่ยน role แล้วจะค้างได้ถึง 7 วัน)
   - บัญชีที่ถูกระงับ (`disabledAt`) ถูก `redirect("/suspended")` ที่นี่ หน้านั้นต้องใช้ `getSessionUser()`
     และอยู่นอก `(app)` เพราะ JWT ยังไม่หมดอายุ proxy ยังมองว่าล็อกอินอยู่ — ใช้ `getCurrentUser()` = วนลูป
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
   ข้อยกเว้นเดียว: บัญชีถูกระงับได้ "บัญชีนี้ถูกระงับ" — `authorize()` โยน `AccountDisabled`
   **หลังรหัสผ่านถูกแล้วเท่านั้น** คนเดารหัสจึงไม่รู้อะไรเพิ่ม
7. **อีเมลเก็บเป็นตัวพิมพ์เล็กเสมอ** (schema สมัคร/ล็อกอินและ `authorize()` แปลงก่อน) ไม่งั้นคนสมัคร
   `ADMIN@x` จะได้บัญชีใหม่ที่ `isAdminEmail()` (ซึ่งไม่สนตัวพิมพ์) นับเป็นแอดมิน

### การกันสิทธิ์ (authorization) — ทำ 2 ชั้น

- **ชั้นนอก (`proxy.ts`)** — เช็คแบบ optimistic อย่างเดียวว่ามี session ไหม
  ไม่มี → เด้งไป `/login?next=<path>` / มีแล้วแต่เข้า `/login` `/signup` → เด้งกลับ `/`
  **ห้ามเอา business logic หรือ query DB มาไว้ในนี้**
- **ชั้นใน (ของจริง)** — ทุก Server Action และทุก page ต้องเช็คเองเสมอ:
  ```ts
  const user = await getCurrentUser();                       // ต้องล็อกอิน
  const access = await assertBoardAccess(boardId, user);     // owner / member / อาจารย์ของวิชา
  if (!access?.canEdit) return;   // action ที่แก้ข้อมูล
  if (!access) notFound();        // page ที่แค่อ่าน (viewer เข้าได้)
  ```
  proxy ถูกข้ามได้ ห้ามพึ่งมันเป็นด่านเดียว

### สิทธิ์ในบอร์ด (`BoardRole`)

`assertBoardAccess(boardId, user)` รับ `{ id, role }` (ส่ง `user` จาก `getCurrentUser()` ทั้งก้อนได้เลย)
แล้วคืน `{ id, ownerId, role, isOwner, canEdit, canReview, courseId, requiresApproval }` มาให้
**ห้ามให้ action ไปตีความ role เอง** ใช้ `canEdit` / `canReview` / `requiresApproval` ที่มันคำนวณมาแล้ว

| | ดูบอร์ด | แก้การ์ด/คอลัมน์/ป้าย/priority | คอมเมนต์ | เชิญสมาชิก | ตรวจงาน/ให้คะแนน |
|---|---|---|---|---|---|
| OWNER (`Board.ownerId`) | ✓ | ✓ | ✓ | ✓ | ✗ |
| EDITOR (`BoardMember.role`) | ✓ | ✓ | ✓ | ✗ | ✗ |
| VIEWER (`BoardMember.role`) | ✓ | ✗ | ✗ | ✗ | ✗ |
| TEACHER (อาจารย์เจ้าของรายวิชาที่บอร์ดผูกอยู่) | ✓ เฉพาะบอร์ดในวิชาตัวเอง | ✗ | ✗ | ✗ | ✓ |

**role ของผู้ใช้ทั้งระบบ (`User.role`)** — USER (นักศึกษา) / TEACHER / ADMIN ตั้งจากหน้า `/admin`
อีเมลใน env `ADMIN_EMAILS` เป็น ADMIN เสมอ (ทางเข้าของแอดมินคนแรก และกันแอดมินล็อกตัวเองออก)
`canTeach(role)` = TEACHER หรือ ADMIN, `canManageUsers(role)` = ADMIN (`lib/roles.ts`)

- **อาจารย์เห็นเฉพาะบอร์ดที่ผูกกับรายวิชาที่ตัวเองเป็นเจ้าของ** (`board.course.teacherId`) ไม่ต้องถูกเชิญ
  ได้ `canEdit: false` + `canReview: true` อาจารย์ที่เป็นสมาชิกอยู่แล้วใช้ role เดิม แค่ได้ `canReview` เพิ่ม
  บอร์ดที่ไม่ผูกวิชาเป็นบอร์ดส่วนตัว ไม่มีอาจารย์คนไหนเห็น (แอดมินก็ไม่เห็นวิชาของอาจารย์คนอื่น)
  `accessibleBoardWhere()` ไม่นับอาจารย์ — dashboard/ค้นหา/ปฏิทินของอาจารย์ยังเป็นของตัวเอง
- **แอดมิน** (`app/(app)/admin/actions.ts` ผ่าน `editableTarget()`): แก้ตัวเองไม่ได้ แก้แอดมินจาก env ไม่ได้
  และลดอาจารย์ที่ยังเป็นเจ้าของรายวิชาเป็นนักศึกษา/ระงับไม่ได้ (บอร์ดในวิชาจะค้างไม่มีใครอนุมัติ)
- **รายวิชา**: เจ้าของบอร์ดผูกด้วยรหัสเข้าร่วม (`linkBoardToCourseAction`) ได้ครั้งเดียว
  การถอนออกเป็นสิทธิ์ของอาจารย์ (`unlinkBoardAction`) — ไม่งั้นนักศึกษาถอนแล้วลบบอร์ดเพื่อลบคะแนนได้
- **จัดการสมาชิก** (`setMemberRoleAction` / `removeMemberAction` เจ้าของเท่านั้น, `leaveBoardAction` สมาชิกเอง)
  เอาออกแล้วต้องลบ `CardAssignee` ของคนนั้นในบอร์ดด้วย (`removeMembership()`)

- **action ที่แก้ข้อมูลต้องเช็ค `access.canEdit` ไม่ใช่แค่ `access` ไม่เป็น null**
  เขียนใหม่แล้วลืมบรรทัดนี้ = viewer แก้ข้อมูลได้
- role มาตอนเชิญ (`createInviteAction` → `BoardInvite.role` → `BoardMember.role`)
  หรือมาจากลิงก์แชร์ (`BoardShareLink.role` → `BoardMember.role`)
  ค่าที่ไม่รู้จักตกเป็น `EDITOR` เท่ากับ default เดิมของ schema
- **การเปิด/ปิด/สร้างลิงก์แชร์ใหม่เป็นสิทธิ์ระดับเจ้าของ** เท่ากับการเชิญสมาชิก
  (`updateShareLinkAction` / `regenerateShareLinkAction` เช็ค `ownerId` ตรง ๆ ไม่ใช้ `canEdit`)
- ฝั่ง UI รับ prop `canEdit` ไล่ลงจาก `board/[id]/page.tsx` เพื่อ**ซ่อนปุ่มที่กดไม่ได้**
  — เป็นแค่เรื่อง UX เท่านั้น client component ถูกข้ามได้เสมอ ด่านจริงคือฝั่ง action

### Environment variables

- `DATABASE_URL` — connection string ของ PostgreSQL
- `AUTH_SECRET` — กุญแจเข้ารหัส session JWT (สร้างด้วย `npx auth secret`)
  เปลี่ยนค่านี้ = ผู้ใช้ทุกคนหลุด login
- `BLOB_READ_WRITE_TOKEN` — โทเคนของ Vercel Blob สำหรับอัปโหลดไฟล์แนบ
  ไม่ใส่ก็ยังแนบ "ลิงก์" ได้ตามปกติ การอัปโหลดไฟล์จะคืน error ให้แสดงในรายการไฟล์
- `ADMIN_EMAILS` — อีเมลแอดมินคั่นด้วย comma (ไม่สนตัวพิมพ์) เป็นแอดมินเสมอ แก้จากหน้าเว็บไม่ได้
  **สร้างบัญชีของอีเมลนี้ไว้ก่อน** (seed สร้าง `admin@kanban.dev` ให้) ไม่งั้นใครสมัครอีเมลนี้ก่อนได้เป็นแอดมิน
  อาจารย์ไม่ได้มาจาก env แล้ว (เลิกใช้ `TEACHER_EMAILS`) — ตั้ง role ที่หน้า `/admin`

---

## Data model (ดูของจริงที่ `prisma/schema.prisma`)

`User` → `Board` (owner) → `List` → `Card`
เสริมด้วย `BoardMember` (แชร์บอร์ด), `BoardInvite` (เชิญด้วย token), `BoardShareLink` (ลิงก์ทั่วไป),
`Label`, `Priority`, `Checklist`/`ChecklistItem`, `Comment`, `Attachment`, `Activity`,
`PointEvent` (ledger แต้ม), `CardReview` (ผลตรวจของอาจารย์), `Course` (รายวิชา)

จุดที่ต้องรู้:

- **owner ไม่มีแถวใน `BoardMember`** — สิทธิ์เต็มมาจาก `Board.ownerId` ตรง ๆ
  `assertBoardAccess()` เช็ค `ownerId` หรือ membership อย่างใดอย่างหนึ่ง
- **`position` เป็น `Float` ไม่ใช่ `Int`** — เวลาลากแทรกกลางให้คำนวณค่าระหว่างเพื่อนบ้าน
  จะได้ไม่ต้องเขียนลำดับใหม่ทั้งคอลัมน์
- **`Priority` ตั้งเองต่อบอร์ด** (ชื่อ+สีกำหนดได้) การ์ดผูกได้ทีละ 1 priority
- **`List.isDoneList`** — คอลัมน์ "เสร็จสิ้น" ของบอร์ด มีได้บอร์ดละ 1 คอลัมน์ และ**อยู่ขวาสุดเสมอ**
  (`flagDoneList()` ล้างธงเดิมแล้วดันคอลัมน์ไปท้ายสุด, `reorderListAction` ห้ามเลยมันไป,
  ฝั่ง client ปิดการลากคอลัมน์นี้และใช้ `clampBeforeDone()`)
  บอร์ดที่ยังไม่มีคอลัมน์เสร็จสิ้น ถ้าสร้าง/เปลี่ยนชื่อคอลัมน์เป็นชื่อใน `DONE_LIST_NAMES`
  (done/finish/เสร็จสิ้น ฯลฯ ตรงทั้งชื่อ) จะถูกตั้งธงให้อัตโนมัติ — รายชื่อนี้ต้องตรงกับ SQL ใน
  migration `review_workflow`
- **`List.isReviewList`** — คอลัมน์ "กำลังตรวจสอบ" บอร์ดละ 1 คอลัมน์ และเป็นคอลัมน์เดียวกับ Done ไม่ได้
  **บอร์ดที่ผูกรายวิชาและมีคอลัมน์นี้ (`access.requiresApproval`) การ์ดจะ "เข้า" คอลัมน์เสร็จสิ้นได้ก็ต่อเมื่อ
  `canReview`** (`needsTeacherApproval()` ใน `board/[id]/actions.ts`) ต้องให้อาจารย์อนุมัติที่ `/review`
  บอร์ดส่วนตัว (ไม่ผูกวิชา) ลากเข้าได้เองแม้มีคอลัมน์ตรวจ — ไม่มีอาจารย์ บังคับแล้วการ์ดจะค้างตลอดไป
  บอร์ดใหม่ได้ 4 คอลัมน์พร้อมธงทั้งสองตั้งแต่สร้าง และตอนผูกวิชาจะสร้างคอลัมน์ที่ขาดให้
- **`Board.courseId`** — บอร์ดละ 1 วิชา (`onDelete: SetNull`) **บอร์ดในรายวิชา: ลบบอร์ดไม่ได้,
  ลบการ์ดที่มีผลตรวจไม่ได้, ลบคอลัมน์ที่มีการ์ดแบบนั้นไม่ได้** (กันคะแนนหายจาก CSV ของอาจารย์)
- **`PointEvent.boardId` เป็น nullable (`onDelete: SetNull`)** — ลบบอร์ดแล้วแต้มยังอยู่ ("ได้แล้วไม่ริบคืน")
- **`User.reviewsSeenAt`** — ผลตรวจที่ `updatedAt` ใหม่กว่านี้ = แจ้งเตือนที่ยังไม่อ่าน (`lib/notifications.ts`)
  หน้า `/my-reviews` ตั้งค่านี้เป็น **เวลาที่ server render หน้า** ไม่ใช่เวลาที่กดเปิด
- **`Card.submittedById` / `submittedAt`** — ตั้งตอนการ์ด "เข้า" คอลัมน์ตรวจ (`submissionFields()`)
  แต้มตอนอาจารย์อนุมัติไปที่คนนี้ (ไม่มี = `createdById`) และโบนัสทันกำหนดวัดจาก `submittedAt`
  ไม่ใช่เวลาที่อาจารย์กด — ตรวจช้าแล้วนักศึกษาต้องไม่เสียโบนัส
- **`CardReview`** — การ์ดละ 1 แถว (`cardId @unique`) ตรวจซ้ำ = upsert ทับ
  `score` เป็น null ได้ (ส่งกลับแก้ไขไม่ต้องมีคะแนน) **คะแนนจากอาจารย์แยกจากแต้ม gamification**
- **`List.color` / `List.description`** ผู้ใช้ตั้งเองต่อคอลัมน์ (nullable ทั้งคู่)
  คอลัมน์เก่าที่ยังไม่มีสีจะ fallback ไปใช้สีตามลำดับคอลัมน์ (`LIST_ACCENTS`)
- **`Card.isCompleted` = สถานะตอนนี้ / `Card.completedAt` = เคยเสร็จหรือยัง**
  ลากออกจากคอลัมน์เสร็จสิ้นจะเซ็ต `isCompleted = false` แต่ **ห้ามล้าง `completedAt`**
- **`BoardShareLink` แยกจาก `BoardInvite` โดยตั้งใจ** — invite ใช้ครั้งเดียวและผูกอีเมล
  ส่วน share link ใช้ซ้ำได้ ไม่ผูกอีเมล บอร์ดละ 1 ลิงก์ (`boardId` เป็น `@unique`)
  `enabled` เริ่มที่ `false` เสมอ และ **`enabled` คือด่านจริง ไม่ใช่การเดา token ไม่ออก**
- **`Attachment.blobPathname` ต้องเก็บไว้เสมอ** สำหรับไฟล์ที่อัปโหลด ไม่งั้นลบ attachment แล้ว
  ไฟล์จะค้างใน Blob กินโควตาไปเรื่อย ๆ (`deleteAttachmentAction` เรียก `del()` ก่อนลบแถว)
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
- ตรรกะทั้งหมดรวมอยู่ที่ `syncCardCompletion(tx, card, targetList, boardId, earner, onTimeAt?)`
  ใน `lib/card-completion.ts` ซึ่งถูกเรียกจาก `moveCardAction`, `reorderCardAction` และ
  `reviewCardAction` — ถ้าจะเพิ่มทางเข้าใหม่ (เช่น ปุ่มติ๊กเสร็จ) ให้เรียกฟังก์ชันนี้
  ห้ามเขียนกติกาแต้มซ้ำที่อื่น มันรับ `tx` เพื่อให้การย้ายการ์ด + กิจกรรม + แต้ม อยู่ใน transaction เดียว
- action ที่ให้แต้มต้อง `revalidatePath("/")` ด้วย ไม่งั้นแถบโปรไฟล์บน dashboard ไม่อัปเดต
- **แผงอันดับในรายวิชา** (`components/dashboard/leaderboard.tsx` + `lib/leaderboard.ts`)
  คนในอันดับ = เจ้าของ + สมาชิกของบอร์ดในวิชาเดียวกับเรา (ไม่นับอาจารย์ผู้สอน) ไม่ได้อยู่วิชาไหน = ไม่เห็นใคร
  **จัดอันดับด้วยแต้มที่ได้จากบอร์ดในวิชานั้นเท่านั้น** (ทั้งหมด / 7 วันล่าสุด) เพราะบอร์ดในวิชาต้องผ่าน
  อาจารย์อนุมัติก่อนได้แต้ม ส่วนบอร์ดส่วนตัวปั๊มแต้มเองได้ — เลเวล/สตรีคที่โชว์ยังมาจากแต้มรวม
  วิชาที่เลือกใน URL (`?lb=`) ต้องอยู่ในผล `getMyCourses()` เท่านั้น ห้ามรับ courseId จาก URL ตรง ๆ
  การจัดอันดับเป็นฟังก์ชันบริสุทธิ์ `rankEntries()` ใน `lib/points.ts` (แต้มเท่ากันได้อันดับเดียวกัน 1, 2, 2, 4)

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
  ใน `ConfirmSubmitButton` ปุ่มสองจังหวะมี `key` ต่างกัน (`idle` / `confirm`) **ห้ามเอาออก**
  ไม่งั้น React จะ patch ปุ่มเดิมจาก `type="button"` เป็น `type="submit"` ระหว่างจัดการคลิกแรก
  แล้วเบราว์เซอร์ทำ default action ของคลิกนั้นต่อ = กดครั้งเดียวลบเลย (เคยหลุดมาแล้ว)
- ไอคอนทั้งหมดอยู่ที่ `components/ui/icons.tsx`
  **ห้ามตั้งชื่อไฟล์ว่า `icon.tsx` ในโฟลเดอร์ `app/`** เพราะ Next จะมองว่าเป็น metadata route
  แล้ว build พังด้วย "Default export is missing"
- ตัวอักษรไทยมาจาก `Noto_Sans_Thai` (`next/font/google`) ที่ต่อท้าย Geist ใน `--font-sans`

### หน้าบอร์ด

- การ์ดบนคอลัมน์โชว์แค่ข้อมูลสรุป (ชื่อ/กำหนดส่ง/priority/ผู้รับผิดชอบ/ความคืบหน้า checklist/
  จำนวนไฟล์แนบ) **การแก้ไขทุกอย่างอยู่ใน `card-detail-dialog.tsx`**
  อย่าเอาฟอร์มกลับไปแปะบนการ์ดอีก
- **ไฟล์แนบใช้ `<img>` ธรรมดา ไม่ใช่ `next/image`** เพราะ attachment แบบลิงก์ชี้ไปโฮสต์ไหนก็ได้
  ซึ่งครอบด้วย `images.remotePatterns` ไม่ได้ (มี `eslint-disable-next-line` กำกับไว้พร้อมเหตุผล)
  ลิงก์ออกนอกทุกอันต้องมี `rel="noopener noreferrer"` และ URL ต้องผ่าน `sanitizeAttachmentUrl()`
  ก่อนเก็บเสมอ ไม่งั้น `javascript:` กลายเป็น XSS ตอนเรนเดอร์เป็น `href`
- **การสร้าง/แก้ไขบอร์ด คอลัมน์ และการ์ด ทำผ่าน modal ทั้งหมด ห้ามเอาช่องกรอก inline กลับมา**
  สร้างบอร์ด → `app-shell/create-board-dialog.tsx` / แก้บอร์ด → หัวข้อ "ข้อมูลบอร์ด"
  ใน `board-settings-dialog.tsx` (เห็นเฉพาะเจ้าของ) — **ปุ่ม "บันทึกข้อมูลบอร์ด" อยู่ที่ footer
  ล่างสุดของ modal** ช่องกรอกจึงผูกกับฟอร์มนั้นด้วย attribute `form="board-info-<id>"`
  แบบเดียวกับ `card-detail-dialog.tsx` (ปุ่มของ section อื่นทำงานทันทีอยู่แล้ว คงไว้ inline)
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
- สามช่องขวาของ modal การ์ด (ระดับความสำคัญ / ป้ายกำกับ / ผู้รับผิดชอบ) เป็น dropdown ที่
  `card-field-selects.tsx` ทั้งหมด — กดปุ่มแล้วค่อยกางตัวเลือกทั้งหมดของบอร์ด
  **อย่าเอาตัวเลือกกลับมาเรียงโชว์ค้างอีก** บอร์ดที่สมาชิกเยอะจะล้น และอวาตาร์ที่เห็นแค่
  ตัวอักษรแรกจะซ้ำกันจนแยกคนไม่ออก (ในเมนูจึงต้องมีชื่อเต็ม + อีเมลกำกับ)
  เปลือกของ dropdown อยู่ที่ `components/ui/select-menu.tsx` (เปิด/ปิด + คลิกนอกเมนู + ดัก Esc)
  ตัวมันดัก Esc ไว้เองตอนเมนูเปิด (`preventDefault`) **ห้ามเอาออก** ไม่งั้น Esc จะปิด `<dialog>` ทั้งการ์ด
  priority เลือกได้ค่าเดียว `setCardPriorityAction` จึงเป็น "ตั้งค่าตรง ๆ" ไม่ใช่ toggle อีกต่อไป
  (ส่ง `priorityId` ว่าง = ล้างค่า) ส่วนป้าย/ผู้รับผิดชอบเลือกได้หลายค่า จึงยัง toggle เหมือนเดิม
- หน้าสร้างการ์ดใช้ layout สองคอลัมน์และ dropdown ชุดเดียวกับหน้ารายละเอียด
  โดยส่ง `onChange` ให้ dropdown เก็บค่าในฟอร์มก่อนมี `cardId` (ห้ามยิง action ก่อนสร้าง)
  `lib/card-create.ts` ตรวจข้อมูล แล้ว `createCardAction` บันทึกการ์ดพร้อมความสัมพันธ์
  เช็กลิสต์ ลิงก์ ความคิดเห็น และกิจกรรมใน transaction เดียว ตรวจสิทธิ์และขอบเขตบอร์ดบนเซิร์ฟเวอร์
- การ์ดเดิมอัปโหลดทันทีที่เลือก รองรับหลายไฟล์ แต่ส่งทีละไฟล์เพราะ bodySizeLimit เป็นลิมิตต่อ request
  ไม่ต้องมีปุ่มอัปโหลดแยก ส่วนการ์ดใหม่เก็บไฟล์ในหน่วยความจำและแสดง “รอสร้างการ์ด”
  เมื่อกดเพิ่มการ์ดจึงอัปโหลดอัตโนมัติหลังได้ `cardId` ยกเลิกก่อนสร้างแล้วไม่มีข้อมูลค้าง
  `attachment-upload.tsx` ใช้ ID รายไฟล์ (ไม่ใช้ชื่อ) พร้อมภาพตัวอย่างและ error รายไฟล์
  เมื่ออัปโหลดบางใบล้มเหลวให้ลองใหม่โดยใช้ `cardId`/attachment ID เดิม ไม่สร้างการ์ดซ้ำ
  modal สร้างการ์ดใช้ `busy` กัน Esc/ปิด/กดซ้ำระหว่างบันทึก และยังคงค่าฟอร์มเมื่อผิดพลาด
- **ปุ่ม + ระหว่างคอลัมน์** อยู่ *ใน* `SortableList` (absolute ยื่นไปกลางช่อง `gap-4`) ไม่ใช่ element แยก
  ระหว่างคอลัมน์ — ของแทรกใน `SortableContext` ทำให้ `horizontalListSortingStrategy` คำนวณการเลื่อนเพี้ยน
  ไม่มีทางขวาของคอลัมน์เสร็จสิ้น/คอลัมน์สุดท้าย และซ่อนระหว่างลาก
- คำสั่งของคอลัมน์ (แก้ไข / เพิ่มคอลัมน์ทางซ้าย-ขวา / ตั้งเป็นคอลัมน์เสร็จสิ้น / ตั้งเป็นคอลัมน์ตรวจสอบ / ลบ)
  อยู่ในเมนู ⋯ ที่ `list-menu.tsx` — แทรกคอลัมน์ส่งแค่ `anchorListId` + `side` ไป
  ตำแหน่งจริงคำนวณที่ `createListAction` ด้วย `insertListPosition()` ห้ามเชื่อตำแหน่งจาก client
- **ข้อมูล User ที่ส่งเข้า client component ต้องใช้ `select: publicUserSelect` (`types.ts`) เสมอ
  ห้าม `user: true` / `owner: true`** — props ถูก serialize ลงหน้าเว็บทั้งก้อน เคยทำ `passwordHash`
  ของสมาชิกทุกคนหลุดไปให้ทุกคนที่เปิดบอร์ดเห็น (รวม viewer ที่เข้าทางลิงก์แชร์)
  token ของลิงก์แชร์ก็ส่งให้เฉพาะเจ้าของ (`shareLink={access.isOwner ? … : null}`)
- ลากการ์ดเข้าเสร็จสิ้นในบอร์ดที่มีคอลัมน์ตรวจ: client เช็คก่อน (ไม่ทำ optimistic update + `Toast tone="warn"`)
  ถ้า action ยังคืน `{ error }` อยู่ (state เก่า) `kanban-board.tsx` ต้องย้อน `setLists(initialLists)` เอง
  เพราะ action ที่ปฏิเสธไม่มี revalidate มาแก้ state ให้

---

## Convention ของโค้ด

### Server Actions

- **React 19 รีเซ็ตฟอร์มหลัง action จบเสมอ** — ช่อง uncontrolled กลับเป็นค่า default ตอน mount
  ฟอร์มที่ต้องคงค่าเมื่อ error ให้ใช้ controlled input (ดู `review-form.tsx`, `LinkCourseForm`)
  และ dropdown ที่ auto-submit ต้องมี `key` ตามค่าที่บันทึก (ดู dropdown สิทธิ์สมาชิกใน `board-settings-dialog.tsx`)
  ไม่งั้นบันทึกแล้วแต่หน้าจอเด้งกลับไปโชว์ค่าเดิม
- ไฟล์ `"use server"` export ได้แค่ async function — schema ที่ใช้ร่วมกันวางไว้ใน `lib/` (เช่น `lib/password.ts`)
- **ไฟล์ดาวน์โหลด (CSV) ทำผ่าน Server Action ที่คืน string** แล้ว client สร้าง Blob เอง
  (`csv-download-button.tsx`) — ยังคงกติกา "ไม่มี API route นอกจากของ NextAuth"

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
- **query ที่ไม่ขึ้นต่อกันให้ยิงพร้อมกันด้วย `Promise.all`** (ดู `board/[id]/page.tsx`, `sidebar.tsx`)
  ทุก round trip ไป DB มีราคา await ต่อกันเป็นทอดคือหน้าช้าลงเป็นเท่าตัว
- **`vercel.json` ตั้ง `regions: ["sin1"]` ห้ามลบ** — Neon อยู่ `ap-southeast-1` ค่าเริ่มต้นของ Vercel คือ iad1
  (สหรัฐฯ) ทำให้ทุก query ข้ามแปซิฟิก ~200ms (วัดได้จาก header `X-Vercel-Id: sin1::iad1::…`)
  ย้าย DB ไป region อื่นเมื่อไหร่ ต้องย้าย region ของ function ตาม
- หน้าที่ดึงข้อมูลเยอะควรมี `loading.tsx` ไม่งั้นคลิกแล้วจอนิ่งจนกว่า render เสร็จ

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
npx prisma migrate dev       # สร้าง migration (Prisma 7: รัน npx prisma generate ต่อด้วย)
npx prisma studio            # เปิดดูข้อมูลในฐานข้อมูล
npx prisma db seed           # ใส่ข้อมูลตัวอย่าง (รัน prisma/seed.ts พร้อมโหลด .env)
```

**หลังแก้โค้ดทุกครั้งให้รัน `npx tsc --noEmit` และ `npm run build`**
บั๊กหลายตัวของโปรเจกต์นี้ (prerender, UntrustedHost) โผล่เฉพาะตอน build/production เท่านั้น

## หนี้ทางเทคนิคที่รู้อยู่แล้ว

- (แก้แล้ว) `kanban-board.tsx` เลิกใช้ `useEffect` sync props แล้ว เปลี่ยนไปเซ็ต state
  ระหว่าง render ตามแพตเทิร์นที่ React แนะนำ — `npm run lint` ตอนนี้ผ่านสะอาด ห้ามทำให้พังอีก
- test ครอบเฉพาะฟังก์ชันบริสุทธิ์ (`lib/due.ts`, `lib/points.ts`, `lib/drag.ts`, `lib/roles.ts`, `lib/csv.ts` ฯลฯ)
  ยังไม่มี integration test ที่แตะ DB หรือ Server Action — ตรรกะสิทธิ์ (`canEdit`/`canReview`)
  และด่านอาจารย์อนุมัติจึงยังต้องทดสอบด้วยมือ
- `prisma/seed.ts` ไม่โหลด `.env` เอง ต้องรันผ่าน `npx prisma db seed` (`npx tsx prisma/seed.ts`
  ตรง ๆ จะพังด้วย `DATABASE_URL is not set`)
- นักศึกษายังลากการ์ดที่อาจารย์อนุมัติแล้ว "ออก" จากคอลัมน์เสร็จสิ้นได้ (ลากเข้าไม่ได้)
  ผลตรวจยังค้างเป็น APPROVED — ยังไม่ได้ตัดสินใจว่าควรล็อกหรือไม่
- ลบการ์ดที่เคยได้แต้มแล้วสร้างใหม่ = ได้แต้มอีกรอบ (cuid เปลี่ยน) — ช่องโหว่ที่ยอมรับได้
- ตอนตั้งคอลัมน์เสร็จสิ้น การ์ดที่อยู่ในคอลัมน์นั้นอยู่แล้วจะถูกมาร์กว่าเสร็จ แต่ไม่ได้แต้มย้อนหลัง
  (ไม่รู้ว่าใครเป็นคนทำ) และ `prisma/seed.ts` ใช้ `update: {}` จึงไม่เติม `dueDate`
  ให้การ์ด seed ที่มีอยู่ก่อนแล้ว
- **เปลี่ยน/ตั้งรหัสผ่านใหม่แล้ว session เดิมไม่หลุด** (JWT ล้วน ไม่มีตาราง session ให้ลบ)
  การระงับบัญชีเป็นทางเดียวที่ตัดผู้ใช้ที่ล็อกอินค้างออกได้ทันที
- **`prisma migrate dev` ผ่าน pooler ของ Neon (`-pooler` ใน host) อาจค้าง advisory lock** แล้ว migrate
  ครั้งถัดไป timeout (P1002) — ให้รัน migrate ด้วย connection ตรง (เอา `-pooler` ออกจาก host ชั่วคราว)
  ถ้าค้างแล้ว ปิด backend ที่ idle และถือ lock `72707369` อยู่ (ดู `pg_locks`)
- dev server ที่เปิดค้างไว้ถือ Prisma Client ตัวเก่าไว้ใน `globalThis` (`lib/prisma.ts`) — แก้ schema แล้ว
  ต้องรีสตาร์ต `npm run dev` ไม่งั้นฟิลด์ใหม่ (เช่น `role`) เป็น `undefined`
