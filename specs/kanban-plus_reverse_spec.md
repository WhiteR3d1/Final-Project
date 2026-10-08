# Kanban+ — Reverse-engineered Specification

> สร้างด้วย skill `spec-miner` จากการอ่านโค้ดจริง (branch `feat/app-shell-gamification`, commit `18011c7`)
> ทุกข้อสังเกตอ้างอิงตำแหน่งในโค้ด — **[ข้อเท็จจริง]** = เห็นในโค้ด / **[อนุมาน]** = ตีความจากโค้ด

---

## 1. Technology stack & architecture

| ชั้น | เทคโนโลยี | หลักฐาน |
|---|---|---|
| Framework | Next.js 16.3 App Router, React 19.2, Server Actions ล้วน | `package.json` |
| DB | PostgreSQL ผ่าน Prisma 7 + `@prisma/adapter-neon` | `prisma/schema.prisma`, `lib/prisma.ts` |
| Auth | NextAuth v5 beta — Credentials + JWT (อายุ 7 วัน) | `auth.ts`, `auth.config.ts` |
| Validation | Zod 4 | `app/actions/auth.ts`, `lib/card-create.ts` |
| DnD | `@dnd-kit` | `app/(app)/board/[id]/kanban-board.tsx` |
| ไฟล์ | `@vercel/blob` (public access) | `actions.ts:895` |
| Test | Node test runner ผ่าน `tsx` — **48 test ผ่านทั้งหมด** | `lib/*.test.ts` |

**ลำดับการทำงานของ request:**

```
Browser ─► proxy.ts (เช็คแค่ว่ามี JWT ไหม) ─► Server Component / Server Action
                                              │
                                              ├─ lib/dal.ts  getCurrentUser()   ← ตัวตน
                                              ├─ lib/board-access.ts assertBoardAccess() ← สิทธิ์
                                              └─ prisma ─► Postgres (Neon)
```

ไม่มี API route นอกจาก `app/api/auth/[...nextauth]` · client component รับข้อมูลผ่าน props อย่างเดียว

## 2. ขนาดโค้ดและไฟล์หลัก

ไม่นับ lockfile และโค้ดที่ generate มา มีราว 9,500 บรรทัด ไฟล์ที่ใหญ่และสำคัญที่สุดคือ

| ไฟล์ | บรรทัด | บทบาท |
|---|---|---|
| `app/(app)/board/[id]/actions.ts` | 1028 | Server Action ของบอร์ดทั้งหมด 30 ตัว |
| `app/(app)/board/[id]/kanban-board.tsx` | 487 | DnD + ฟิลเตอร์ + state ของบอร์ด |
| `app/(app)/board/[id]/card-detail-dialog.tsx` | 328 | modal แก้การ์ด |
| `prisma/schema.prisma` | 304 | โมเดล 17 ตัว, enum 5 ตัว |
| `app/(app)/board/[id]/card-field-selects.tsx` | 269 | dropdown priority/ป้าย/ผู้รับผิดชอบ |

## 3. Observed requirements (EARS)

### 3.1 Authentication
- **REQ-AUTH-1** When ผู้ใช้ที่ยังไม่ล็อกอินเปิดหน้าใดที่ไม่ใช่ `/login` `/signup`, the system shall redirect ไป `/login?next=<path+query>` — `proxy.ts:14-20`
- **REQ-AUTH-2** When ผู้ใช้ที่ล็อกอินแล้วเปิด `/login` หรือ `/signup`, the system shall redirect ไป `/` — `proxy.ts:23-25`
- **REQ-AUTH-3** When ล็อกอินไม่ผ่าน, the system shall แสดง "อีเมลหรือรหัสผ่านไม่ถูกต้อง" โดยไม่แยกว่าผิดช่องไหน — `app/actions/auth.ts:44`
- **REQ-AUTH-4** When ล็อกอินสำเร็จ, the system shall redirect ไป `next` เฉพาะเมื่อขึ้นต้นด้วย `/` และไม่ใช่ `//` (กัน open redirect) — `app/actions/auth.ts:22-28`
- **REQ-AUTH-5** The system shall บังคับชื่อ ≥ 2 ตัวอักษร และรหัสผ่าน ≥ 8 ตัวอักษรตอนสมัคร แล้วล็อกอินให้อัตโนมัติ — `app/actions/auth.ts:72-104`
- **REQ-AUTH-6** When สมัครด้วยอีเมลที่มีอยู่แล้ว, the system shall คืน "อีเมลนี้ถูกใช้งานแล้ว" — `app/actions/auth.ts:91-94`
  *(ข้อนี้ทำให้เดาได้ว่ามีอีเมลนี้ในระบบ ซึ่งขัดกับเจตนาของ REQ-AUTH-3 แต่ฟอร์มสมัครส่วนใหญ่ก็ยอมรับจุดนี้)*

### 3.2 สิทธิ์ในบอร์ด
- **REQ-ACL-1** The system shall ให้สิทธิ์เข้าบอร์ดเฉพาะเจ้าของ (`Board.ownerId`) หรือสมาชิก (`BoardMember`) — `lib/board-access.ts:24-31`
- **REQ-ACL-2** While ผู้ใช้เป็น VIEWER, the system shall ปฏิเสธ action ที่แก้ข้อมูลทุกตัว (เช็ค `canEdit`) — ยืนยันแล้วว่า **ทั้ง 26 action ที่แก้ข้อมูล** ใน `actions.ts` เช็ค `canEdit`
- **REQ-ACL-3** การเชิญ / ลิงก์แชร์ / แก้ข้อมูลบอร์ด shall ทำได้เฉพาะเจ้าของ — `actions.ts:756,799,818`, `app/actions/board.ts:63`
- **REQ-ACL-4** When ผู้ใช้ที่ไม่มีสิทธิ์เปิด `/board/<id>`, the system shall ตอบ 404 (ไม่บอกว่ามีบอร์ดนี้อยู่) — `board/[id]/page.tsx:21`
- **REQ-ACL-5** การค้นหาข้ามบอร์ด shall ค้นเฉพาะบอร์ดที่เข้าถึงได้ ผ่าน `accessibleBoardWhere()` — `search/page.tsx:18`

### 3.3 คำเชิญ & ลิงก์แชร์
- **REQ-INV-1** When เจ้าของเชิญด้วยอีเมล, the system shall สร้าง token แบบ UUID อายุ 7 วัน — `actions.ts:758-759`
- **REQ-INV-2** When รับคำเชิญ, the system shall เช็คว่าสถานะยังเป็น `PENDING`, ยังไม่หมดอายุ และอีเมลตรงกับผู้ใช้ (ไม่สนตัวพิมพ์) — `invite/[token]/actions.ts:16-19`
- **REQ-INV-3** Where เปิดลิงก์แชร์อยู่ (`enabled`), the system shall ให้ผู้ใช้ที่ล็อกอินแล้วเข้าร่วมด้วย role ของลิงก์ โดยไม่ลดสิทธิ์สมาชิกเดิม (`update: {}`) — `invite/[token]/actions.ts:54-75`
- **REQ-INV-4** When สร้าง token ลิงก์แชร์ใหม่, the system shall ทำให้ลิงก์เดิมใช้ไม่ได้ทันที — `actions.ts:811-829`

### 3.4 List / Card
- **REQ-CARD-1** When สร้างบอร์ด, the system shall สร้างคอลัมน์เริ่มต้น "To Do / Doing / Done" — `app/actions/board.ts:8`
  *(ชื่อเป็นภาษาอังกฤษ ทั้งที่ UI เป็นภาษาไทย)*
- **REQ-CARD-2** When สร้างการ์ด, the system shall บันทึกการ์ดพร้อมป้าย/ผู้รับผิดชอบ/เช็กลิสต์/ลิงก์/คอมเมนต์/กิจกรรมใน transaction เดียว และตรวจว่า priority/ป้าย/ผู้รับผิดชอบอยู่ในบอร์ดเดียวกัน — `actions.ts:204-233`
- **REQ-CARD-3** When สร้างการ์ดซ้ำด้วย `requestId` เดิม, the system shall คืนการ์ดใบเดิม (idempotent) — `actions.ts:198-203`
- **REQ-CARD-4** When ลากการ์ดข้ามคอลัมน์, the system shall บันทึก activity `CARD_MOVED` และปฏิเสธคอลัมน์ปลายทางที่อยู่คนละบอร์ด — `actions.ts:316`
- **REQ-CARD-5** The system shall คำนวณตำแหน่งใหม่เป็นค่ากึ่งกลางระหว่างเพื่อนบ้าน (`Float`) — `lib/drag.ts:33-38`

### 3.5 Gamification
- **REQ-GAME-1** When การ์ดเข้าคอลัมน์ Done ครั้งแรก, the system shall ให้ +10 แต้ม และ +5 ถ้าทันกำหนด (เทียบตามวันในเวลาไทย) — `lib/points.ts:10-13`, `lib/gamification.ts:41-49`
- **REQ-GAME-2** The system shall ให้แต้มแต่ละชนิดได้ครั้งเดียวต่อการ์ด (`@@unique([cardId, type])` + `skipDuplicates`) — `schema.prisma:301`
- **REQ-GAME-3** When การ์ดออกจาก Done, the system shall ตั้ง `isCompleted=false` โดยไม่ลบแต้มและไม่ล้าง `completedAt` — `actions.ts:76-81`
- **REQ-GAME-4** เลเวล = เลขที่มากที่สุดที่ `(n-1)²·10 + (n-1)·40 ≤ แต้ม` (สูงสุด 99) — `lib/points.ts:28-31`

### 3.6 ไฟล์แนบ
- **REQ-ATT-1** The system shall รับลิงก์เฉพาะ `http:`/`https:` — `lib/attachments.ts:21-34`
- **REQ-ATT-2** The system shall จำกัดไฟล์อัปโหลดไม่เกิน 4MB และเช็คซ้ำที่ฝั่ง server — `actions.ts:876`
- **REQ-ATT-3** When อัปโหลดขึ้น Blob แล้วแต่บันทึกลง DB ไม่สำเร็จ, the system shall ลบไฟล์ใน Blob ทิ้ง ยกเว้นกรณีที่มีแถวอ้างถึงไฟล์นั้นอยู่แล้ว — `actions.ts:904-912`
- **REQ-ATT-4** When ลบไฟล์แนบ, the system shall ลบไฟล์ใน Blob ก่อนลบแถวใน DB — `actions.ts:930-934`

## 4. Non-functional observations

- **Security (จุดดี):** มี server-only guard, open-redirect guard, sanitize URL, ข้อความล็อกอินพลาดแบบไม่แยกช่อง, เช็คสิทธิ์สองชั้น และไม่มี `dangerouslySetInnerHTML` เลย
- **Performance:** `getUserBoards()` นับการ์ดด้วย `groupBy` (ข้อมูลที่ส่งข้ามเครือข่ายเป็น O(คอลัมน์)) · หน้าบอร์ดดึงทั้งต้นไม้ใน query เดียว (lists→cards→checklists/comments/attachments) ซึ่งจะหนักเมื่อบอร์ดใหญ่
- **Error handling:** action ส่วนใหญ่ใช้ `findUniqueOrThrow` เมื่อ id ไม่ถูกต้องจึงโยน error (ได้ 500) แทนการ `return` เงียบ ๆ ตามที่ convention กำหนด
- **i18n:** `Activity.message` สร้างเป็นภาษาอังกฤษ (`"... moved ... to ..."`) แต่แสดงบนหน้าบอร์ดภาษาไทย — `board/[id]/page.tsx:164`
- **Tests:** มีเฉพาะฟังก์ชันบริสุทธิ์ (due, points, drag, attachments, card-create) ยังไม่มีเทสต์ของสิทธิ์หรือ action

## 5. ⚠️ Findings — ปัญหาที่เจอ (เรียงจากร้ายแรงสุด)

### F1 — 🔴 bcrypt hash ของสมาชิกรั่วไปถึงเบราว์เซอร์ [ข้อเท็จจริง] — ✅ แก้แล้ว (`publicUserSelect`)
`board/[id]/page.tsx:27-48` ใช้ `owner: true`, `members: { include: { user: true } }`,
`comments.include.user: true` และ `assignees.include.user: true` ทำให้ได้ `User` ทั้งแถว
**รวม `passwordHash`** แล้วส่งต่อเป็น prop `boardMembers` / `initialLists` เข้า `KanbanBoard` ซึ่งเป็น `"use client"`
React จะ serialize props ทั้งหมดลงใน RSC payload
→ **ใครก็ตามที่เปิดบอร์ดได้ (รวมถึง VIEWER ที่เข้ามาทางลิงก์แชร์) เปิด DevTools แล้วเห็น bcrypt hash และอีเมลของสมาชิกทุกคนได้** แล้วเอาไปเดารหัสผ่านแบบ offline ได้
**แนวทางแก้:** เปลี่ยนเป็น `select: { id, name, email, image }` ทุกจุด และแก้ `types.ts` ให้ตรงกัน

### F2 — 🟠 ผูก priority / ป้าย / ผู้รับผิดชอบข้ามบอร์ดได้ [ข้อเท็จจริง] — ✅ แก้แล้ว (`cardRefsInBoard`)
`createCardAction` ตรวจขอบเขตบอร์ดครบ แต่ action ที่ใช้แก้การ์ดภายหลังไม่ตรวจ:
- `setCardPriorityAction` (`actions.ts:409`) และ `updateCardAction` (`actions.ts:374`) ไม่เช็คว่า `priorityId` อยู่ในบอร์ดนี้
- `toggleCardLabelAction` (`actions.ts:700`) ไม่เช็คว่า `labelId` อยู่ในบอร์ดนี้
- `toggleCardAssigneeAction` (`actions.ts:732`) ไม่เช็คว่า `userId` เป็นสมาชิก → ยัดผู้ใช้คนไหนก็ได้ในระบบ (ถ้ารู้ id) ลงบอร์ด
  แล้ว F1 จะดึงข้อมูลของคนนั้นมาแสดงด้วย
ผู้ที่ทำแบบนี้ได้ต้องเป็น EDITOR ของบอร์ดตัวเองอยู่แล้ว แต่ข้อมูลของบอร์ดอื่น (ชื่อ/สีของ priority และป้าย) จะรั่วข้ามมา

### F3 — 🟡 รับตำแหน่งจาก client โดยไม่ตรวจค่า — ✅ แก้แล้ว (`Number.isFinite`)
`reorderListAction` / `reorderCardAction` รับ `newPosition: number` จาก client ตรง ๆ (`actions.ts:179, 320`)
ส่ง `NaN` หรือ `Infinity` มาได้ → ลำดับคอลัมน์หรือการ์ดพัง ควรเช็คด้วย `Number.isFinite()`

### F4 — ~~`setDoneListAction` ไม่เซ็ต `completedAt`~~ (ประเมินผิด — ตั้งใจไว้แบบนี้)
ตรวจซ้ำแล้ว dashboard นับจาก `isCompleted` ไม่ใช่ `completedAt` และ `board-card.tsx` ใช้
`!isCompleted && completedAt` แสดงชิป "ได้แต้มแล้ว" ถ้าเซ็ต `completedAt` ตอนตั้งธง
การ์ดที่ไม่เคยได้แต้มจะขึ้นชิปนี้ผิด ๆ จึงคงพฤติกรรมเดิมไว้

### F5 — 🟢 เรื่องเล็ก ๆ
- `moveCardAction` / `reorderCardAction` อัปเดตการ์ด → สร้าง activity → sync สถานะเสร็จ แยกเป็น 3 query ที่ไม่อยู่ใน transaction เดียวกัน
- `uploadAttachmentAction` ไม่จำกัดชนิดไฟล์ จึงอัปโหลด `.svg`/`.html` แบบ public ได้ แต่ Blob เสิร์ฟจากโดเมนอื่น ความเสี่ยงจึงต่ำ
- หน้าบอร์ดส่งคอมเมนต์ทั้งหมดของทุกการ์ดไปให้ client ตั้งแต่โหลดหน้า

## 6. Inferred acceptance criteria (สำหรับเขียนเทสต์ในอนาคต)

1. VIEWER เรียก action ที่แก้ข้อมูลตัวไหนก็ได้ → ข้อมูลใน DB ไม่เปลี่ยน
2. ลากการ์ดเข้า-ออก-เข้า Done 3 รอบ → `PointEvent` ของการ์ดนั้นมี ≤ 2 แถว
3. ลิงก์แชร์ที่ `enabled=false` → `joinViaShareLinkAction` ไม่สร้าง `BoardMember`
4. สมาชิก EDITOR กดลิงก์แชร์ที่ให้สิทธิ์ VIEWER → role ยังเป็น EDITOR
5. RSC payload ของหน้าบอร์ดต้องไม่มีคำว่า `passwordHash` *(ตอนนี้ไม่ผ่าน — ดู F1)*

## 7. Uncertainties

- การเปลี่ยนชื่อ Next 16 `middleware → proxy` เชื่อตาม CLAUDE.md ยังไม่ได้ตรวจกับ `node_modules/next/dist/docs/`
- `PLAN-auto-upload.md` ดูเหมือนแผนงานที่ทำเสร็จแล้ว (commit `18011c7`) ควรลบหรือย้ายไปไว้ใน docs
- ยังไม่รู้ว่าโปรเจกต์จะ deploy จริงหรือใช้แค่ demo ซึ่งมีผลต่อว่า F1/F2 เร่งด่วนแค่ไหน

## 8. Recommendations

1. **แก้ F1 ก่อนอย่างอื่น** (ใช้เวลาไม่กี่นาที แต่เป็นช่องโหว่จริง)
2. เพิ่มการเช็คขอบเขตบอร์ดใน F2 โดยใช้แพตเทิร์นเดียวกับที่ `createCardAction` ใช้อยู่
3. แยก `actions.ts` (1028 บรรทัด) ตามโดเมน: list / card / meta (label, priority) / sharing / attachment
4. เขียน integration test ของ `canEdit` ตามข้อ 6 (CLAUDE.md ยอมรับไว้แล้วว่ายังไม่มี)
