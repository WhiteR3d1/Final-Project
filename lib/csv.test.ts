import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { csvCell, toCsv } from "./csv";
import { generateJoinCode, JOIN_CODE_ALPHABET, normalizeJoinCode } from "./join-code";

describe("csvCell", () => {
  it("ค่าธรรมดาไม่ต้องครอบเครื่องหมายคำพูด", () => {
    assert.equal(csvCell("งานบทที่ 1"), "งานบทที่ 1");
    assert.equal(csvCell(85), "85");
  });

  it("ค่าว่างเป็นช่องว่าง", () => {
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
  });

  it("มี comma / เครื่องหมายคำพูด / ขึ้นบรรทัดใหม่ ต้องครอบและ escape", () => {
    assert.equal(csvCell("a,b"), '"a,b"');
    assert.equal(csvCell('พูดว่า "ดี"'), '"พูดว่า ""ดี"""');
    assert.equal(csvCell("บรรทัด1\nบรรทัด2"), '"บรรทัด1\nบรรทัด2"');
  });

  it("กันสูตร Excel ที่มาจากข้อความของผู้ใช้", () => {
    assert.equal(csvCell("=1+1"), "'=1+1");
    assert.equal(csvCell("+66"), "'+66");
    assert.equal(csvCell("-5"), "'-5");
    assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(csvCell('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`);
  });

  it("ตัวเลขติดลบที่เราสร้างเองไม่ถูกเติม '", () => {
    assert.equal(csvCell(-5), "-5");
  });
});

describe("toCsv", () => {
  it("ขึ้นต้นด้วย BOM และคั่นแถวด้วย CRLF", () => {
    assert.equal(toCsv([["ก", 1], ["ข", null]]), "﻿ก,1\r\nข,\r\n");
  });
});

describe("join code", () => {
  it("ยาว 6 ตัวและใช้แค่ตัวอักษรที่อ่านไม่สับสน", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      assert.equal(code.length, 6);
      assert.ok([...code].every((char) => JOIN_CODE_ALPHABET.includes(char)), code);
    }
  });

  it("ไม่มี 0 O 1 I L ในชุดตัวอักษร", () => {
    for (const char of "0O1IL") assert.equal(JOIN_CODE_ALPHABET.includes(char), false, char);
  });

  it("กำหนดผลสุ่มเองได้ (สำหรับเทสต์)", () => {
    assert.equal(generateJoinCode(() => 0), "AAAAAA");
  });

  it("รับรหัสที่พิมพ์ตัวเล็ก มีช่องว่าง หรือขีด", () => {
    assert.equal(normalizeJoinCode(" ab3-k9x "), "AB3K9X");
  });
});
