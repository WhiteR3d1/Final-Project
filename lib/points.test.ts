import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEVEL_TITLES,
  levelFromPoints,
  pointsToReachLevel,
  rankEntries,
  streakFromDayKeys,
} from "./points";

describe("pointsToReachLevel", () => {
  it("เลเวล 1 เริ่มที่ 0 แต้ม และช่วงห่างกว้างขึ้นเรื่อย ๆ", () => {
    assert.equal(pointsToReachLevel(1), 0);
    assert.equal(pointsToReachLevel(2), 50);
    assert.equal(pointsToReachLevel(3), 120);

    const gap12 = pointsToReachLevel(2) - pointsToReachLevel(1);
    const gap23 = pointsToReachLevel(3) - pointsToReachLevel(2);
    assert.ok(gap23 > gap12);
  });
});

describe("levelFromPoints", () => {
  it("ยังไม่มีแต้มก็อยู่เลเวล 1", () => {
    const result = levelFromPoints(0);
    assert.equal(result.level, 1);
    assert.equal(result.currentFloor, 0);
    assert.equal(result.progress, 0);
    assert.equal(result.pointsToNext, 50);
  });

  it("ขึ้นเลเวลพอดีตอนแต้มถึงเกณฑ์ ไม่ใช่เกินเกณฑ์", () => {
    assert.equal(levelFromPoints(49).level, 1);
    assert.equal(levelFromPoints(50).level, 2);
    assert.equal(levelFromPoints(119).level, 2);
    assert.equal(levelFromPoints(120).level, 3);
  });

  it("progress อยู่ในช่วง 0-100 เสมอ", () => {
    for (const points of [0, 1, 49, 50, 119, 500, 10_000]) {
      const { progress } = levelFromPoints(points);
      assert.ok(progress >= 0 && progress <= 100, `progress ของ ${points} แต้มหลุดช่วง: ${progress}`);
    }
  });

  it("pointsToNext ไม่ติดลบ", () => {
    for (const points of [0, 50, 500, 1_000_000]) {
      assert.ok(levelFromPoints(points).pointsToNext >= 0);
    }
  });

  it("แต้มสูงมากก็ไม่ทะลุเพดานเลเวล 99 และยังมีชื่อระดับเสมอ", () => {
    const result = levelFromPoints(100_000_000);
    assert.equal(result.level, 99);
    assert.equal(result.title, LEVEL_TITLES[LEVEL_TITLES.length - 1]);
  });
});

describe("streakFromDayKeys", () => {
  // 12:00 ตามเวลาไทยของวันที่ 2 ก.ย. 2026
  const now = new Date("2026-09-02T05:00:00Z");

  it("ไม่มีกิจกรรมเลย = 0", () => {
    assert.equal(streakFromDayKeys(new Set(), now), 0);
  });

  it("นับวันติดต่อกันย้อนจากวันนี้", () => {
    const keys = new Set(["2026-09-02", "2026-09-01", "2026-08-31"]);
    assert.equal(streakFromDayKeys(keys, now), 3);
  });

  it("ยังไม่ทำวันนี้แต่ทำเมื่อวาน = สตรีคยังไม่ขาด", () => {
    const keys = new Set(["2026-09-01", "2026-08-31"]);
    assert.equal(streakFromDayKeys(keys, now), 2);
  });

  it("ขาดไปสองวันแล้ว = 0", () => {
    const keys = new Set(["2026-08-31", "2026-08-30"]);
    assert.equal(streakFromDayKeys(keys, now), 0);
  });

  it("หยุดนับตรงวันที่ขาด ไม่นับช่วงก่อนหน้าต่อ", () => {
    const keys = new Set(["2026-09-02", "2026-09-01", "2026-08-29", "2026-08-28"]);
    assert.equal(streakFromDayKeys(keys, now), 2);
  });

  it("ข้ามสิ้นเดือนได้ถูก", () => {
    const firstOfMonth = new Date("2026-09-01T05:00:00Z");
    const keys = new Set(["2026-09-01", "2026-08-31", "2026-08-30"]);
    assert.equal(streakFromDayKeys(keys, firstOfMonth), 3);
  });
});

describe("rankEntries", () => {
  const people = (points: number[]) =>
    points.map((value, index) => ({ userId: `u${index}`, name: `คน${index}`, points: value }));

  it("เรียงแต้มมากไปน้อย", () => {
    const rows = rankEntries(people([5, 30, 10]), "u0");
    assert.deepEqual(rows.map((row) => [row.userId, row.rank]), [["u1", 1], ["u2", 2], ["u0", 3]]);
  });

  it("แต้มเท่ากันได้อันดับเดียวกัน แล้วอันดับถัดไปข้ามไป (1, 2, 2, 4)", () => {
    const rows = rankEntries(people([40, 20, 20, 10]), "u0");
    assert.deepEqual(rows.map((row) => row.rank), [1, 2, 2, 4]);
  });

  it("แต้มเท่ากันเรียงตามชื่อ ลำดับจึงไม่สลับไปมาทุกครั้งที่โหลด", () => {
    const rows = rankEntries(
      [
        { userId: "b", name: "สมหญิง", points: 10 },
        { userId: "a", name: "กมล", points: 10 },
      ],
      "x"
    );
    assert.deepEqual(rows.map((row) => row.userId), ["a", "b"]);
  });

  it("ตัดเหลือ limit อันดับแรก แต่ต่อแถวของฉันท้ายสุดถ้าไม่ติด", () => {
    const rows = rankEntries(people([60, 50, 40, 30, 20, 10, 5]), "u6", 5);
    assert.equal(rows.length, 6);
    assert.deepEqual(rows.at(-1), { userId: "u6", name: "คน6", points: 5, rank: 7, isMe: true });
  });

  it("ฉันติดอันดับต้น ๆ อยู่แล้ว ไม่ซ้ำแถว", () => {
    const rows = rankEntries(people([60, 50, 40, 30, 20, 10]), "u1", 5);
    assert.equal(rows.length, 5);
    assert.equal(rows.filter((row) => row.isMe).length, 1);
  });

  it("คนที่ไม่ได้อยู่ในรายชื่อ (เช่นอาจารย์) ไม่มีแถวของตัวเองต่อท้าย", () => {
    assert.equal(rankEntries(people([3, 2, 1]), "teacher", 2).length, 2);
  });

  it("ไม่มีใครเลย = ว่าง", () => {
    assert.deepEqual(rankEntries([], "u0"), []);
  });
});
