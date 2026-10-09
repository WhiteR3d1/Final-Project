import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canManageUsers, canTeach, effectiveRole, isAdminEmail, parseEmailList } from "./roles";

describe("parseEmailList", () => {
  it("แยกด้วย comma ตัดช่องว่าง เป็นตัวพิมพ์เล็ก และทิ้งช่องว่างเปล่า", () => {
    assert.deepEqual([...parseEmailList(" A@uni.ac.th , b@uni.ac.th,,")], ["a@uni.ac.th", "b@uni.ac.th"]);
  });

  it("ไม่ได้ตั้งค่าไว้ = รายชื่อว่าง", () => {
    assert.equal(parseEmailList(undefined).size, 0);
    assert.equal(parseEmailList("").size, 0);
  });
});

describe("isAdminEmail", () => {
  const raw = "Admin@Uni.ac.th";

  it("ไม่สนตัวพิมพ์ทั้งฝั่ง env และฝั่งอีเมล", () => {
    assert.equal(isAdminEmail("admin@uni.ac.th", raw), true);
    assert.equal(isAdminEmail("ADMIN@UNI.AC.TH", raw), true);
  });

  it("ต้องตรงทั้งอีเมล ไม่ใช่แค่บางส่วน", () => {
    assert.equal(isAdminEmail("admin@uni.ac", raw), false);
    assert.equal(isAdminEmail("xadmin@uni.ac.th", raw), false);
  });
});

describe("effectiveRole", () => {
  const env = "boss@uni.ac.th";

  it("อีเมลใน ADMIN_EMAILS เป็น ADMIN เสมอ แม้ DB จะตั้งเป็น USER", () => {
    assert.equal(effectiveRole({ email: "boss@uni.ac.th", role: "USER" }, env), "ADMIN");
  });

  it("คนอื่นใช้ role จาก DB", () => {
    assert.equal(effectiveRole({ email: "t@uni.ac.th", role: "TEACHER" }, env), "TEACHER");
    assert.equal(effectiveRole({ email: "s@uni.ac.th", role: "USER" }, env), "USER");
  });

  it("ไม่มี env = ใช้ role จาก DB ทั้งหมด", () => {
    assert.equal(effectiveRole({ email: "boss@uni.ac.th", role: "USER" }, ""), "USER");
  });
});

describe("สิทธิ์ตาม role", () => {
  it("อาจารย์และแอดมินสอนได้ นักศึกษาไม่ได้", () => {
    assert.equal(canTeach("TEACHER"), true);
    assert.equal(canTeach("ADMIN"), true);
    assert.equal(canTeach("USER"), false);
  });

  it("จัดการผู้ใช้ได้เฉพาะแอดมิน", () => {
    assert.equal(canManageUsers("ADMIN"), true);
    assert.equal(canManageUsers("TEACHER"), false);
    assert.equal(canManageUsers("USER"), false);
  });
});
