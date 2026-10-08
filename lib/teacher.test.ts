import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTeacherEmail, parseTeacherEmails } from "./teacher";

describe("parseTeacherEmails", () => {
  it("แยกด้วย comma ตัดช่องว่าง และทิ้งช่องว่างเปล่า", () => {
    assert.deepEqual(
      [...parseTeacherEmails(" a@uni.ac.th , b@uni.ac.th,,")],
      ["a@uni.ac.th", "b@uni.ac.th"]
    );
  });

  it("ไม่ได้ตั้งค่าไว้ = ไม่มีอาจารย์เลย", () => {
    assert.equal(parseTeacherEmails(undefined).size, 0);
    assert.equal(parseTeacherEmails("").size, 0);
  });
});

describe("isTeacherEmail", () => {
  const raw = "Teacher@Uni.ac.th,b@uni.ac.th";

  it("ไม่สนตัวพิมพ์เล็กใหญ่ทั้งฝั่ง env และฝั่งอีเมลผู้ใช้", () => {
    assert.equal(isTeacherEmail("teacher@uni.ac.th", raw), true);
    assert.equal(isTeacherEmail("TEACHER@UNI.AC.TH", raw), true);
  });

  it("อีเมลที่ไม่อยู่ในรายชื่อไม่ใช่อาจารย์", () => {
    assert.equal(isTeacherEmail("student@uni.ac.th", raw), false);
  });

  it("ต้องตรงทั้งอีเมล ไม่ใช่แค่บางส่วน", () => {
    assert.equal(isTeacherEmail("teacher@uni.ac", raw), false);
    assert.equal(isTeacherEmail("xteacher@uni.ac.th", raw), false);
  });

  it("ไม่มี env = ไม่มีใครเป็นอาจารย์", () => {
    assert.equal(isTeacherEmail("teacher@uni.ac.th", ""), false);
  });
});
