import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateKey, daysUntilDue, dueBucket, dueLabel, isOnTime } from "./due";

/**
 * ทุกเคสในไฟล์นี้เขียนเป็นเวลา UTC แล้วคาดหวังผลลัพธ์ตามเวลาไทย (UTC+7)
 * เพราะนั่นคือบั๊กที่ lib/due.ts มีไว้ป้องกัน — เทียบวันด้วย Date.now() ตรง ๆ จะเพี้ยนข้ามวัน
 */

describe("dateKey", () => {
  it("ให้คีย์วันที่ตามเวลาไทย ไม่ใช่ UTC", () => {
    // 17:00Z = เที่ยงคืนของวันถัดไปตามเวลาไทย
    assert.equal(dateKey(new Date("2026-09-02T17:00:00Z")), "2026-09-03");
    assert.equal(dateKey(new Date("2026-09-02T16:59:59Z")), "2026-09-02");
  });

  it("ข้ามสิ้นเดือนและสิ้นปีได้ถูก", () => {
    assert.equal(dateKey(new Date("2026-12-31T17:00:00Z")), "2027-01-01");
    assert.equal(dateKey(new Date("2026-01-31T17:00:00Z")), "2026-02-01");
  });

  it("เรียงลำดับด้วยการเทียบ string ได้ (รูปแบบ YYYY-MM-DD)", () => {
    assert.ok(dateKey(new Date("2026-09-02T00:00:00Z")) < dateKey(new Date("2026-09-10T00:00:00Z")));
  });
});

describe("daysUntilDue", () => {
  // dueDate มาจาก <input type="date"> จึงเป็นเที่ยงคืน UTC เสมอ
  const due = (day: string) => new Date(`${day}T00:00:00Z`);
  const now = new Date("2026-09-02T05:00:00Z"); // เที่ยงวันของวันที่ 2 ตามเวลาไทย

  it("นับเป็นวันปฏิทิน ไม่ใช่ชั่วโมงหาร 24", () => {
    assert.equal(daysUntilDue(due("2026-09-02"), now), 0);
    assert.equal(daysUntilDue(due("2026-09-03"), now), 1);
    assert.equal(daysUntilDue(due("2026-09-09"), now), 7);
  });

  it("ติดลบเมื่อเลยกำหนดมาแล้ว", () => {
    assert.equal(daysUntilDue(due("2026-09-01"), now), -1);
    assert.equal(daysUntilDue(due("2026-08-30"), now), -3);
  });

  it("ยังตอบ 0 แม้เวลาไทยจะดึกแล้ว (เคสที่ UTC ทำพัง)", () => {
    // 22:00 ตามเวลาไทยของวันที่ 2 = 15:00Z ของวันที่ 2
    assert.equal(daysUntilDue(due("2026-09-02"), new Date("2026-09-02T15:00:00Z")), 0);
    // 00:30 ตามเวลาไทยของวันที่ 3 = 17:30Z ของวันที่ 2 -> ข้ามวันแล้ว
    assert.equal(daysUntilDue(due("2026-09-02"), new Date("2026-09-02T17:30:00Z")), -1);
  });
});

describe("dueBucket", () => {
  const due = (day: string) => new Date(`${day}T00:00:00Z`);
  const now = new Date("2026-09-02T05:00:00Z");

  it("แบ่งกลุ่มตามเส้นแบ่ง 0 / 1 / 7 / 8 วัน", () => {
    assert.equal(dueBucket(due("2026-09-01"), now), "overdue");
    assert.equal(dueBucket(due("2026-09-02"), now), "today");
    assert.equal(dueBucket(due("2026-09-03"), now), "soon");
    assert.equal(dueBucket(due("2026-09-09"), now), "soon"); // +7 ยังนับเป็น soon
    assert.equal(dueBucket(due("2026-09-10"), now), "later"); // +8 ออกจาก soon
  });
});

describe("isOnTime", () => {
  const due = new Date("2026-09-02T00:00:00Z");

  it("ส่งก่อนหรือตรงวันกำหนด = ทัน", () => {
    assert.equal(isOnTime(due, new Date("2026-09-01T10:00:00Z")), true);
    assert.equal(isOnTime(due, new Date("2026-09-02T03:00:00Z")), true);
  });

  it("ส่งสี่ทุ่มเวลาไทยของวันครบกำหนด = ยังทัน", () => {
    // 22:00 ตามเวลาไทย = 15:00Z ของวันเดียวกัน — ถ้าเทียบด้วย UTC ตรง ๆ จะยังทันเหมือนกัน
    assert.equal(isOnTime(due, new Date("2026-09-02T15:00:00Z")), true);
  });

  it("ส่งตอนตีหนึ่งของวันถัดไปตามเวลาไทย = สาย", () => {
    // 01:00 ของวันที่ 3 ตามเวลาไทย = 18:00Z ของวันที่ 2
    // เทียบด้วย UTC ตรง ๆ จะตอบผิดว่า "ยังทัน" เพราะยังไม่พ้นวันที่ 2 ในโซน UTC
    assert.equal(isOnTime(due, new Date("2026-09-02T18:00:00Z")), false);
  });
});

describe("dueLabel", () => {
  const due = (day: string) => new Date(`${day}T00:00:00Z`);
  const now = new Date("2026-09-02T05:00:00Z");

  it("ใช้คำที่ต่างกันตามความเร่งด่วน", () => {
    assert.equal(dueLabel(due("2026-09-02"), now), "ครบกำหนดวันนี้");
    assert.equal(dueLabel(due("2026-09-03"), now), "ครบกำหนดพรุ่งนี้");
    assert.equal(dueLabel(due("2026-09-05"), now), "เหลืออีก 3 วัน");
    assert.equal(dueLabel(due("2026-08-31"), now), "เลยกำหนด 2 วัน");
  });
});
