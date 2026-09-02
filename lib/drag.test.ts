import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { positionBetween, resolveListDropTarget } from "./drag";

/**
 * บอร์ดจำลอง 3 คอลัมน์ คอลัมน์กลางมีการ์ด
 * เคสสำคัญคือ "ลากคอลัมน์แล้วปล่อยทับการ์ด" ซึ่งเป็นบั๊กที่พบตอนทดสอบ 7 ส.ค. 2569
 */
const lists = [
  { id: "list-a", cards: [{ id: "card-a1" }] },
  { id: "list-b", cards: [{ id: "card-b1" }, { id: "card-b2" }] },
  { id: "list-c", cards: [] },
];

describe("resolveListDropTarget", () => {
  it("ปล่อยทับการ์ดในคอลัมน์อื่น = ย้ายไปคอลัมน์นั้น (บั๊กเดิมคืนค่าไม่เจอแล้วเงียบ)", () => {
    assert.equal(resolveListDropTarget(lists, "list-a", "card-b2"), "list-b");
  });

  it("ปล่อยทับตัวคอลัมน์ตรง ๆ ก็ยังใช้ได้เหมือนเดิม", () => {
    assert.equal(resolveListDropTarget(lists, "list-a", "list-c"), "list-c");
  });

  it("ปล่อยทับคอลัมน์ว่างที่ไม่มีการ์ดเลย", () => {
    assert.equal(resolveListDropTarget(lists, "list-b", "list-c"), "list-c");
  });

  it("ปล่อยทับการ์ดของตัวเอง = ไม่ต้องย้าย", () => {
    assert.equal(resolveListDropTarget(lists, "list-b", "card-b1"), null);
  });

  it("ปล่อยทับตัวเอง = ไม่ต้องย้าย", () => {
    assert.equal(resolveListDropTarget(lists, "list-a", "list-a"), null);
  });

  it("id ที่ไม่รู้จัก = ไม่ต้องย้าย", () => {
    assert.equal(resolveListDropTarget(lists, "list-a", "ไม่มีอยู่จริง"), null);
  });
});

describe("positionBetween", () => {
  it("แทรกกลางได้ค่ากึ่งกลาง", () => {
    assert.equal(positionBetween(1, 2), 1.5);
    assert.equal(positionBetween(1.5, 2), 1.75);
  });

  it("แทรกหัวแถวได้ค่าน้อยกว่าตัวแรก", () => {
    assert.equal(positionBetween(undefined, 1), 0);
  });

  it("แทรกท้ายแถวได้ค่ามากกว่าตัวสุดท้าย", () => {
    assert.equal(positionBetween(3, undefined), 4);
  });

  it("คอลัมน์ว่างเริ่มที่ 1", () => {
    assert.equal(positionBetween(undefined, undefined), 1);
  });

  it("แทรกซ้ำ ๆ ตรงกลางแล้วลำดับยังถูกต้อง", () => {
    let left = 1;
    const right = 2;
    for (let i = 0; i < 10; i++) {
      const mid = positionBetween(left, right);
      assert.ok(mid > left && mid < right, `รอบที่ ${i}: ${mid} หลุดช่วง ${left}-${right}`);
      left = mid;
    }
  });
});
