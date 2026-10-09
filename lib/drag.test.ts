import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampBeforeDone,
  insertListPosition,
  isDoneListName,
  positionBetween,
  resolveListDropTarget,
} from "./drag";

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

describe("isDoneListName", () => {
  it("ชื่อที่สื่อว่าเสร็จ ไม่สนตัวพิมพ์และช่องว่าง", () => {
    for (const name of ["Done", " done ", "FINISH", "Finished", "เสร็จสิ้น", "เสร็จ"]) {
      assert.equal(isDoneListName(name), true, name);
    }
  });

  it("ต้องตรงทั้งชื่อ ไม่ใช่แค่มีคำนี้อยู่", () => {
    for (const name of ["Not done", "Doing", "กำลังทำ", "ใกล้เสร็จ", "Done?"]) {
      assert.equal(isDoneListName(name), false, name);
    }
  });
});

describe("insertListPosition", () => {
  const board = [
    { id: "todo", position: 1, isDoneList: false },
    { id: "doing", position: 2, isDoneList: false },
    { id: "done", position: 3, isDoneList: true },
  ];

  it("แทรกทางขวาของคอลัมน์ = ค่ากลางกับเพื่อนบ้านทางขวา", () => {
    assert.equal(insertListPosition(board, "todo", "after"), 1.5);
  });

  it("แทรกทางซ้ายของคอลัมน์แรก = น้อยกว่าคอลัมน์แรก", () => {
    assert.equal(insertListPosition(board, "todo", "before"), 0);
  });

  it("ไม่มี anchor = ต่อท้าย แต่ยังอยู่ก่อนคอลัมน์เสร็จสิ้น", () => {
    assert.equal(insertListPosition(board), 2.5);
  });

  it("ขอแทรกทางขวาของคอลัมน์เสร็จสิ้น = ถูกดันมาไว้ก่อนมัน", () => {
    assert.equal(insertListPosition(board, "done", "after"), 2.5);
  });

  it("บอร์ดที่ไม่มีคอลัมน์เสร็จสิ้น ต่อท้ายได้ตามปกติ", () => {
    const noDone = board.map((list) => ({ ...list, isDoneList: false }));
    assert.equal(insertListPosition(noDone), 4);
  });

  it("anchor ที่ไม่รู้จัก = เหมือนไม่มี anchor", () => {
    assert.equal(insertListPosition(board, "ไม่มีอยู่จริง", "before"), 2.5);
  });

  it("บอร์ดว่างเริ่มที่ 1", () => {
    assert.equal(insertListPosition([]), 1);
  });
});

describe("clampBeforeDone", () => {
  const board = [{ isDoneList: false }, { isDoneList: false }, { isDoneList: true }];

  it("ลากจากซ้ายไปทับคอลัมน์เสร็จสิ้น = หยุดที่ช่องก่อนหน้ามัน", () => {
    assert.equal(clampBeforeDone(board, 0, 2), 1);
  });

  it("ลากสลับกันเองระหว่างคอลัมน์ที่อยู่ก่อนเสร็จสิ้นได้ปกติ", () => {
    assert.equal(clampBeforeDone(board, 1, 0), 0);
  });

  it("คอลัมน์เสร็จสิ้นเองลากไม่ได้", () => {
    assert.equal(clampBeforeDone(board, 2, 0), 2);
  });

  it("บอร์ดที่ไม่มีคอลัมน์เสร็จสิ้นไม่ถูกจำกัด", () => {
    assert.equal(clampBeforeDone([{ isDoneList: false }, { isDoneList: false }], 0, 1), 1);
  });
});
