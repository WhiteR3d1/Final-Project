# Spec: ของพื้นฐานที่ขาด + หน้าแอดมิน + รายวิชาของอาจารย์

> **สถานะ (9 ต.ค. 2569): ทำครบทั้ง 3 phase แล้ว** และผ่าน acceptance criteria ทั้ง 11 ข้อจากการทดสอบ E2E
> ต่างจาก spec 2 จุด:
> - C2 ไม่ได้บันทึก Activity ตอนผูกบอร์ดเข้าวิชา เพราะ `ActivityType` ไม่มีค่าที่เหมาะ ต้องทำ migration เพิ่มก่อน
> - ปุ่มดาวน์โหลด CSV ทดสอบแค่ผลจาก action (เนื้อหา CSV) ยังไม่ได้กดดาวน์โหลดไฟล์จริงในเบราว์เซอร์

> ทำด้วย skill `feature-forge` (สัมภาษณ์ requirement 3 รอบ → spec แบบ EARS → แผนลงมือ)
> และให้ Plan agent ตรวจกับโค้ดจริงแล้ว ตอนลงมือจะคัดลอก spec นี้ไปไว้ที่ `specs/admin-courses.spec.md`

## Context

ตอนนี้ระบบมีช่องโหว่ที่ผู้ใช้เจอจริง 3 กลุ่ม
1. **ของพื้นฐานไม่มีเลย:** ลบบอร์ดไม่ได้, จัดการสมาชิกไม่ได้ (เอาออก / เปลี่ยนสิทธิ์ / ออกจากบอร์ดเอง), เปลี่ยนรหัสผ่านไม่ได้
2. **จัดการผู้ใช้ไม่ได้:** อาจารย์มาจาก env `TEACHER_EMAILS` ต้อง deploy ใหม่ทุกครั้งที่เปลี่ยน และลืมรหัสแล้วไม่มีใครรีเซ็ตให้ได้
3. **อาจารย์เห็นทุกบอร์ดในระบบ:** ใช้กับหลายวิชาไม่ได้ ไม่มีทางเอาคะแนนออกไปกรอกเกรด และนักศึกษาไม่รู้ว่างานถูกตรวจแล้ว

ผลที่ต้องการ: ผู้ใช้จัดการบอร์ด/สมาชิก/รหัสผ่านของตัวเองได้, แอดมินจัดการ role กับบัญชีได้จากหน้าเว็บ, อาจารย์ทำงานเป็นรายวิชา (เห็นเฉพาะวิชาตัวเอง + export CSV), นักศึกษาเห็นแจ้งเตือนผลตรวจ

**ไม่อยู่ในรอบนี้:** จำกัด login ผิด, ล็อกการ์ดที่อนุมัติแล้ว, ขยายขนาดอัปโหลด

### สิ่งที่ผู้ใช้ตัดสินใจแล้ว
| เรื่อง | ตัดสินใจ |
|---|---|
| แอดมินคนแรก | `ADMIN_EMAILS` ใน env เป็นแอดมินเสมอ (ล็อกตัวเองออกไม่ได้) role อื่นตั้งจากหน้าแอดมิน เก็บใน DB |
| รีเซ็ตรหัส | แอดมินพิมพ์รหัสใหม่ให้เอง |
| รายวิชา | อาจารย์สร้างวิชา → ได้รหัสเข้าร่วม → เจ้าของบอร์ดกรอกรหัสเพื่อผูกบอร์ด (บอร์ดละ 1 วิชา) |
| อาจารย์เห็นอะไร | **เฉพาะบอร์ดในวิชาตัวเอง** บอร์ดที่ไม่ผูกวิชาเป็นบอร์ดส่วนตัว และด่านอาจารย์อนุมัติใช้เฉพาะบอร์ดที่ผูกวิชา |
| ลบบอร์ดที่ผูกวิชา | ห้าม ต้องให้อาจารย์ถอนออกจากวิชาก่อน / แต้มยังอยู่แม้ลบบอร์ด |
| กันคะแนนหาย | บอร์ดในวิชา: ลบการ์ดที่มีผลตรวจไม่ได้ และลบคอลัมน์ที่มีการ์ดแบบนั้นไม่ได้ |
| แจ้งเตือน | ผู้ส่ง + ผู้รับผิดชอบ เห็นตัวเลขบน sidebar เปิดหน้าผลตรวจแล้วถือว่าอ่าน |
| CSV | 1 แถวต่อการ์ด, ทุกการ์ดในบอร์ดของวิชา พร้อมคอลัมน์สถานะ |
| แอดมิน | จัดการผู้ใช้อย่างเดียว ไม่เห็นวิชาของอาจารย์คนอื่น (สร้างวิชาของตัวเองได้เหมือนอาจารย์) |

---

## Functional requirements (EARS)

### A. ของพื้นฐาน
- **A1** When เจ้าของกดลบบอร์ด (ยืนยันสองจังหวะ), the system shall ลบบอร์ดพร้อมคอลัมน์/การ์ด แล้วพาไป `/` โดย `PointEvent` ของบอร์ดนั้น**ยังอยู่** (`boardId` → null)
- **A2** While บอร์ดผูกรายวิชาอยู่, the system shall ปฏิเสธการลบบอร์ดพร้อมข้อความ "ให้อาจารย์ถอนบอร์ดออกจากรายวิชาก่อน"
- **A3** When ลบบอร์ดสำเร็จ, the system shall ลบไฟล์ใน Blob ของไฟล์แนบทั้งบอร์ดแบบ best-effort *หลัง* ลบใน DB (ไม่มี token หรือลบไฟล์พลาด ต้องไม่ทำให้ลบบอร์ดล้ม)
- **A4** When เจ้าของเอาสมาชิกออก หรือสมาชิกกดออกจากบอร์ดเอง, the system shall ลบแถว `BoardMember` และ `CardAssignee` ของคนนั้นในการ์ดของบอร์ดนี้ใน transaction เดียว
- **A5** When เจ้าของเปลี่ยน role สมาชิก, the system shall ตั้งเป็น EDITOR หรือ VIEWER เท่านั้น (ค่าอื่นไม่รับ)
- **A6** The system shall ไม่ให้เจ้าของถูกเอาออกหรือออกเอง (เจ้าของไม่มีแถวใน `BoardMember` อยู่แล้ว)
- **A7** When ผู้ใช้เปลี่ยนรหัสผ่าน, the system shall ตรวจรหัสเดิมด้วย bcrypt, ตรวจรหัสใหม่ ≥ 8 ตัวและตรงกับช่องยืนยัน แล้วบันทึก hash ใหม่

### B. Role + แอดมิน
- **B1** The system shall เก็บ role ใน `User.role` (USER / TEACHER / ADMIN) และอีเมลใน `ADMIN_EMAILS` เป็น ADMIN เสมอ ไม่ว่าใน DB จะเป็นอะไร
- **B2** The system shall คำนวณ role จริงครั้งเดียวที่ `getCurrentUser()` (ไม่เก็บใน JWT เพราะจะค้างได้ถึง 7 วัน)
- **B3** The system shall เก็บอีเมลเป็นตัวพิมพ์เล็กเสมอ (สมัคร / ล็อกอิน / migration) — กันการสมัคร `ADMIN@…` แล้วได้สิทธิ์แอดมินจากการเทียบแบบไม่สนตัวพิมพ์
- **B4** Where ผู้ใช้เป็นแอดมิน, the system shall แสดงหน้า `/admin`: รายชื่อผู้ใช้ + ค้นหา, ตั้ง role, ระงับ/ยกเลิกระงับ, ตั้งรหัสผ่านใหม่ (≥ 8 ตัว)
- **B5** The system shall ไม่ให้แอดมินเปลี่ยน role ตัวเอง, ระงับตัวเอง, หรือแก้ role / ระงับแอดมินที่มาจาก env
- **B6** While อาจารย์ยังเป็นเจ้าของรายวิชาอยู่, the system shall ไม่ให้ลด role หรือระงับบัญชีนั้น (ไม่งั้นบอร์ดในวิชาค้าง ไม่มีใครอนุมัติได้)
- **B7** When บัญชีถูกระงับแล้วล็อกอินด้วยรหัสที่ถูก, the system shall แจ้ง "บัญชีนี้ถูกระงับ" (รหัสผิดยังได้ข้อความกลางเหมือนเดิม — ข้อยกเว้นของกฎข้อ 6 ใน CLAUDE.md)
- **B8** While บัญชีถูกระงับระหว่างที่ยังล็อกอินอยู่, the system shall พาทุกหน้าและทุก action ไป `/suspended` ซึ่งมีแค่ข้อความกับปุ่มออกจากระบบ
- **B9** The system shall เลิกใช้ `TEACHER_EMAILS` ทั้งหมด

### C. รายวิชาและฝั่งอาจารย์
- **C1** Where ผู้ใช้เป็น TEACHER/ADMIN, the system shall ให้สร้างวิชาได้ และสุ่มรหัสเข้าร่วม 6 ตัวที่ไม่ซ้ำ (ตัดตัวที่สับสน เช่น 0/O, 1/I) ถ้าชนกันให้สุ่มใหม่
- **C2** When เจ้าของบอร์ดกรอกรหัสใน "ตั้งค่าบอร์ด → รายวิชา", the system shall ผูกบอร์ดเข้าวิชา (รับรหัสแบบไม่สนตัวพิมพ์) ถ้าบอร์ดยังไม่มีคอลัมน์ตรวจหรือคอลัมน์เสร็จสิ้น ให้สร้างให้ แล้วบันทึก Activity
- **C3** While บอร์ดผูกวิชาอยู่แล้ว, the system shall ปฏิเสธการผูกซ้ำหรือย้ายไปวิชาอื่น และการถอนออกจากวิชาทำได้เฉพาะอาจารย์เจ้าของวิชา
- **C4** The system shall ให้อาจารย์เข้าถึงบอร์ด (อ่านอย่างเดียว + `canReview`) **เฉพาะบอร์ดในวิชาที่ตัวเองเป็นเจ้าของ**
- **C5** While บอร์ดผูกวิชาและมีคอลัมน์ตรวจ, the system shall ให้เฉพาะ `canReview` พาการ์ดเข้า Done ได้ ส่วนบอร์ดที่ไม่ผูกวิชา นักศึกษาลากเข้า Done ได้เอง
- **C6** While บอร์ดผูกวิชา, the system shall ไม่ให้ลบการ์ดที่มีผลตรวจ หรือคอลัมน์ที่มีการ์ดแบบนั้น
- **C7** The system shall กรองหน้า `/review` (ทั้งแท็บรอตรวจและตรวจแล้ว) และตัวเลขบน sidebar ด้วยวิชาของอาจารย์ และกรองตามวิชาหรือบอร์ดได้
- **C8** When อาจารย์กด "ดาวน์โหลด CSV" ในหน้าวิชา, the system shall ส่งไฟล์ UTF-8 (มี BOM ให้ Excel อ่านไทยออก) 1 แถวต่อการ์ดของทุกบอร์ดในวิชา
  - คอลัมน์: บอร์ด, คอลัมน์, การ์ด, ผู้ส่ง, อีเมลผู้ส่ง, ผู้รับผิดชอบ, สถานะ (ยังไม่ส่ง/รอตรวจ/อนุมัติ/ส่งกลับแก้ไข), คะแนน, ส่งเมื่อ, กำหนดส่ง, ทันกำหนด, ตรวจเมื่อ, ความเห็น
  - เวลาเป็นเวลาไทย
  - cell ที่ขึ้นต้นด้วย `= + - @ \t \r` ให้เติม `'` นำหน้า (กัน CSV injection)
- **C9** When อาจารย์ตรวจการ์ด, the system shall นับเป็นแจ้งเตือนที่ยังไม่อ่านของผู้ส่ง (ไม่มี = ผู้สร้าง) และผู้รับผิดชอบ ที่ยังเข้าบอร์ดนั้นได้ ยกเว้นตัวอาจารย์เอง
- **C10** When ผู้ใช้เปิดหน้า `/my-reviews`, the system shall แสดงผลตรวจล่าสุดของงานตัวเอง แล้วตั้ง `reviewsSeenAt` เป็นเวลาที่ server render หน้านั้น (ไม่ใช่เวลาตอนกดเปิด ผลตรวจที่มาระหว่างนั้นจะได้ไม่ถูกนับว่าอ่านแล้ว)

## Non-functional
- **ความปลอดภัย:**
  - ทุก action เช็คสิทธิ์ฝั่งเซิร์ฟเวอร์: แอดมินใช้ `canManageUsers`, วิชาใช้ `course.teacherId === me`, บอร์ดใช้ `assertBoardAccess`
  - ข้อมูล User ที่ส่งเข้า client ใช้ select ที่ระบุฟิลด์เอง ไม่มี `passwordHash` (หน้าแอดมินด้วย)
  - CSV export ตรวจสิทธิ์ซ้ำในตัว action
- **ไม่ผิด convention ของโปรเจกต์:**
  - ไม่เพิ่ม dependency และไม่สร้าง API route (CSV คืนเป็น string จาก Server Action แล้ว client สร้าง Blob ดาวน์โหลดเอง)
  - ปุ่มใช้ `SubmitButton` / `ConfirmSubmitButton`, ข้อความเป็นภาษาไทย, สีจาก token เท่านั้น
- **ประสิทธิภาพ:** ตัวเลขบน sidebar คิดที่ `lib/notifications.ts` ครอบด้วย `cache()` เพราะ sidebar render 2 ที่ (desktop + drawer)
- **หนี้ที่ยอมรับ (บันทึกลง CLAUDE.md):** เปลี่ยนหรือรีเซ็ตรหัสแล้ว session เดิมไม่หลุด — การระงับบัญชีเป็นทางเดียวที่ตัดผู้ใช้ออกได้ทันที

## Acceptance criteria
1. **Given** เจ้าของบอร์ดที่ไม่ผูกวิชา และเคยได้แต้มจากบอร์ดนั้น **When** ลบบอร์ด **Then** กลับไปหน้าแรก บอร์ดหายจาก sidebar และแต้มรวมเท่าเดิม
2. **Given** บอร์ดผูกวิชา **When** เจ้าของส่งคำขอลบบอร์ด / ลบการ์ดที่มีคะแนน / ลบคอลัมน์ที่มีการ์ดนั้น (รวมคำขอปลอม) **Then** ข้อมูลไม่เปลี่ยน
3. **Given** สมาชิก EDITOR ที่ถูก assign การ์ดอยู่ **When** เจ้าของเอาออก **Then** คนนั้นเปิดบอร์ดแล้วได้ 404 และหายจากผู้รับผิดชอบ
4. **Given** ผู้ใช้กรอกรหัสเดิมผิด **When** เปลี่ยนรหัส **Then** ได้ "รหัสผ่านเดิมไม่ถูกต้อง" และรหัสไม่เปลี่ยน
5. **Given** อีเมลอยู่ใน `ADMIN_EMAILS` **When** ล็อกอิน **Then** เห็นเมนู "จัดการผู้ใช้" และระงับหรือลด role ตัวเองไม่ได้
6. **Given** แอดมินระงับนักศึกษาที่ล็อกอินค้างอยู่ **When** นักศึกษาคลิกหน้าใดก็ได้ **Then** ไปที่ `/suspended` ไม่วนลูป และล็อกอินใหม่ด้วยรหัสถูกได้ข้อความ "บัญชีนี้ถูกระงับ"
7. **Given** มีคนสมัครด้วย `ADMIN@x` ตอนที่ `ADMIN_EMAILS=admin@x` **Then** ระบบเก็บเป็น `admin@x` (ซึ่งมีบัญชีอยู่แล้ว จึงสมัครไม่ได้) ไม่เกิดบัญชีแอดมินซ้อน
8. **Given** อาจารย์ A กับวิชาของ B **When** A เปิดบอร์ดในวิชาของ B หรือยิง `reviewCardAction` ใส่การ์ดในวิชานั้น **Then** ได้ 404 หรือ "เฉพาะอาจารย์…"
9. **Given** บอร์ดไม่ผูกวิชาแต่มีคอลัมน์ตรวจ **When** นักศึกษาลากการ์ดเข้า Done **Then** เข้าได้และได้แต้มตามปกติ
10. **Given** นักศึกษาส่งตรวจในบอร์ดที่ผูกวิชา **When** อาจารย์อนุมัติ **Then** sidebar ของผู้ส่งและผู้รับผิดชอบขึ้น "ผลตรวจ (1)" และหายเมื่อเปิด `/my-reviews`
11. **Given** วิชาที่มี 2 บอร์ด 5 การ์ด **When** ดาวน์โหลด CSV **Then** ได้ 5 แถว + หัวตาราง เปิดใน Excel อ่านไทยออก และ cell `=1+1` ถูกเติม `'` นำหน้า

## Error handling
| สถานการณ์ | ผล |
|---|---|
| รหัสวิชาผิด / บอร์ดผูกวิชาอยู่แล้ว | "ไม่พบรายวิชานี้" / "บอร์ดนี้อยู่ในรายวิชาแล้ว" (ฟอร์มยังเก็บค่าที่กรอกไว้) |
| ลบบอร์ด / การ์ด / คอลัมน์ ที่ติดวิชา | ไม่ลบ + ข้อความบอกเหตุผล |
| แอดมินแก้ตัวเอง / แก้แอดมินจาก env / ลดสิทธิ์อาจารย์ที่ยังมีวิชา | ปฏิเสธพร้อมเหตุผล |
| รหัสใหม่สั้นกว่า 8 ตัว / ยืนยันไม่ตรง / รหัสเดิมผิด | ข้อความไทยใต้ช่องที่ผิด |
| ลบไฟล์ใน Blob ไม่สำเร็จตอนลบบอร์ด | ลบบอร์ดต่อ แล้ว log error |
| สุ่มรหัสวิชาชนกัน (P2002) | สุ่มใหม่ไม่เกิน 5 ครั้ง |
| บัญชีถูกระงับ | หน้า → `/suspended`, ล็อกอิน → "บัญชีนี้ถูกระงับ" |

---

## Implementation TODO (3 phase — 1 migration ต่อ phase ทดสอบแยกได้)

**0.** คัดลอก spec นี้ไป `specs/admin-courses.spec.md` และยกเลิกการ์ดเสนองาน `task_4ada1df5` (งานซ้ำกับ Phase A)

### Phase A — ของพื้นฐาน
- [ ] Migration `point_event_keep_on_board_delete`: `PointEvent.boardId String?` + `onDelete: SetNull` (ตรวจแล้ว: มีแค่ `getBoardGameSummary` ที่กรองด้วย `boardId` ไม่มี query ไหน include `board`)
- [ ] `app/actions/board.ts`: `deleteBoardAction`
  - ตรวจ `ownerId` เอง
  - ลบใน DB ก่อน แล้วค่อย `del(pathnames[])` ใน try/catch
  - `revalidatePath("/", "layout")` → `redirect("/")`
- [ ] `app/(app)/board/[id]/actions.ts`: `removeMemberAction`, `setMemberRoleAction`, `leaveBoardAction` (ลบ `CardAssignee` ใน transaction เดียวกัน, revalidate บอร์ด + layout)
- [ ] `board/[id]/page.tsx` ส่งรายชื่อสมาชิกพร้อม role (ผ่าน `publicUserSelect`) ไปที่ `board-settings-dialog.tsx`
  - section ใหม่ "สมาชิก": เจ้าของมี dropdown role + ปุ่มเอาออก, สมาชิกจริงมีปุ่ม "ออกจากบอร์ด"
  - section ใหม่ "ลบบอร์ด" ใช้ `ConfirmSubmitButton`
- [ ] หน้าเปลี่ยนรหัสผ่าน: `app/(app)/account/{page.tsx, actions.ts, password-form.tsx}` (`useActionState`, ใช้ Zod schema ตัวเดียวกับตอนสมัคร)
- [ ] `sidebar.tsx`: แถวผู้ใช้เป็นลิงก์ไป `/account`

### Phase B — Role + แอดมิน
- [ ] Migration `user_roles`
  - เพิ่ม `enum UserRole {USER TEACHER ADMIN}`, `User.role @default(USER)`, `User.disabledAt DateTime?`
  - `UPDATE "User" SET email = lower(email)` (เช็คก่อนว่าไม่มีอีเมลซ้ำ)
- [ ] `lib/roles.ts` + `roles.test.ts`: `parseEmailList`, `isAdminEmail`, `effectiveRole`, `canTeach`, `canManageUsers`
  - ลบ `lib/teacher.ts` กับเทสต์ของมัน และลบ `TEACHER_EMAILS` ทุกที่
- [ ] `lib/dal.ts`
  - `getCurrentUser()` คืน `{...user, role: effectiveRole(user)}`, ถ้าถูกระงับ (และไม่ใช่แอดมินจาก env) → `redirect("/suspended")`
  - เพิ่ม `getSessionUser()` ที่ไม่เช็คการระงับ ใช้เฉพาะหน้า `/suspended`
- [ ] Auth
  - `auth.ts` `authorize()`: lowercase อีเมล + โยน `class AccountDisabled extends CredentialsSignin { code = "disabled" }` *หลัง* bcrypt ผ่าน
  - `app/actions/auth.ts`: lowercase ใน schema, จับ `error.code === "disabled"` และ `?code=disabled`
- [ ] `app/suspended/page.tsx` (นอก `(app)`): ถ้าไม่ได้ถูกระงับ → `/`, ถ้าถูกระงับ → แสดงข้อความ + ปุ่ม logout
- [ ] `app/(app)/admin/{page.tsx, actions.ts, user-row.tsx}`: guard B5/B6, select เฉพาะฟิลด์ที่ปลอดภัย
- [ ] ระหว่างรอ Phase C: `board-access.ts` ใช้ `canReview = canTeach(role)` และ `review/page.tsx` / `sidebar.tsx` เปลี่ยนจาก `isTeacherEmail` เป็น role
- [ ] `seed.ts`: ตั้ง `role: TEACHER` ให้บัญชีอาจารย์ทั้งใน `create` และ `update`, ใส่ `ADMIN_EMAILS` ใน README

### Phase C — รายวิชาและฝั่งอาจารย์
- [ ] Migration `courses`
  - เพิ่ม `Course {id, name, joinCode @unique, teacherId, createdAt}` + `Board.courseId` (`onDelete: SetNull`)
  - เพิ่ม `User.reviewsSeenAt` แล้ว backfill เป็น `now()` (ไม่งั้นผลตรวจเก่าทั้งหมดจะนับเป็นยังไม่อ่าน)
- [ ] เพิ่ม lib พร้อมเทสต์: `lib/join-code.ts` (`generateJoinCode`), `lib/csv.ts` (`toCsv` + BOM + กัน injection)
- [ ] `board-access.ts`
  - อาจารย์เข้าบอร์ดได้เฉพาะ `board.course.teacherId === me`
  - คืนค่า `courseId` และ `requiresApproval` (มีคอลัมน์ตรวจ **และ** ผูกวิชา) เพิ่ม
- [ ] `needsTeacherApproval` ใน `board/[id]/actions.ts` และ `blockedFromDone` ใน `kanban-board.tsx` เปลี่ยนไปใช้ `requiresApproval`
- [ ] `deleteCardAction` / `deleteListAction` กันตาม C6, `deleteBoardAction` กันตาม A2
- [ ] หน้าวิชา: `app/(app)/courses/{page.tsx, actions.ts}` (รายการ + สร้าง) และ `courses/[id]/page.tsx`
  - บอร์ดในวิชาพร้อมจำนวนงานรอตรวจ
  - สุ่มรหัสใหม่ / ถอนบอร์ดออก / ลบวิชา
  - `csv-download-button.tsx` เรียก `exportCourseScoresAction`
- [ ] `board-settings-dialog.tsx` section "รายวิชา" + `linkBoardToCourseAction`
  - กันการผูกซ้ำ, uppercase รหัสที่กรอก, สร้างคอลัมน์ตรวจ/เสร็จสิ้นให้ถ้ายังไม่มี
  - บอร์ดที่ยังไม่ผูกวิชาแต่มีคอลัมน์ตรวจ ให้ขึ้นชิป "ยังไม่ผูกรายวิชา"
- [ ] `review/page.tsx` กรองด้วยวิชาของตัวเองในทั้งสองแท็บ + ตัวกรองวิชา
- [ ] แจ้งเตือน
  - `lib/notifications.ts` (`cache()`): นับงานรอตรวจของอาจารย์และผลตรวจที่ยังไม่อ่าน (อยู่ใน `accessibleBoardWhere`, ใช้ `createdById` แทนถ้าไม่มี `submittedById`)
  - `app/(app)/my-reviews/{page.tsx, mark-seen.tsx}` + `markReviewsSeenAction(renderedAt)` แล้ว `revalidatePath("/", "layout")`
- [ ] `sidebar.tsx`: "รายวิชา", "ตรวจงาน (n)", "จัดการผู้ใช้", "ผลตรวจ (n)"
- [ ] `seed.ts`: สร้างวิชาตัวอย่าง (id และรหัสตายตัว) แล้วผูก Study Plan (ใส่ `courseId` ใน `update` ด้วย)
- [ ] อัปเดต CLAUDE.md
  - ตารางสิทธิ์, env vars, โครงสร้างโฟลเดอร์
  - ข้อยกเว้นของกฎข้อ 6 (ข้อความบัญชีถูกระงับ)
  - แพตเทิร์น CSV ผ่าน Server Action, หนี้เรื่อง session ไม่หลุดเมื่อเปลี่ยนรหัส

## Verification (ทำทุก phase)
1. `npx prisma migrate dev` → `npx prisma db seed`
2. `npx tsc --noEmit`, `npm run lint`, `npm test` (เทสต์ใหม่: roles, join-code, csv), `npm run build`
3. E2E บน dev server ด้วยบัญชี seed: นักศึกษา `demo@kanban.dev`, อาจารย์ `teacher@kanban.dev`, แอดมินจาก `ADMIN_EMAILS`
   - ทดสอบผ่าน UI ตาม acceptance criteria 1–11
   - ยิงคำขอปลอมตรงเข้า Server Action (วิธีเดียวกับรอบก่อน: header `Next-Action` + FormData แบบ `_1_` prefix) เพื่อเช็คด่านฝั่งเซิร์ฟเวอร์
     - คนนอกลบบอร์ด / เอาสมาชิกออก
     - อาจารย์ A ตรวจงานในวิชาของ B
     - นักศึกษาเรียก action ของแอดมิน
     - ลบการ์ดที่มีคะแนนในบอร์ดที่ผูกวิชา
   - ตรวจผลจริงใน DB ด้วยสคริปต์ชั่วคราว (ลบทิ้งหลังทดสอบ)
4. ตรวจ RSC payload ของหน้า `/admin`, `/courses/[id]`, `/my-reviews` ว่าไม่มี `passwordHash`
5. ล้างข้อมูลทดสอบ แล้วรายงานผล ไม่ commit จนกว่าผู้ใช้สั่ง
