import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_ATTACHMENT_BYTES,
  attachmentKindForUpload,
  attachmentNameFromUrl,
  formatFileSize,
  isWithinAttachmentSizeLimit,
  sanitizeAttachmentUrl,
} from "./attachments";

describe("sanitizeAttachmentUrl", () => {
  it("รับ http และ https", () => {
    assert.equal(sanitizeAttachmentUrl("https://example.com/a.pdf"), "https://example.com/a.pdf");
    assert.equal(sanitizeAttachmentUrl("  http://example.com/  "), "http://example.com/");
  });

  it("ปฏิเสธ javascript: และ data: ที่เป็นช่องโหว่ XSS ตอนเอาไปใส่ href", () => {
    assert.equal(sanitizeAttachmentUrl("javascript:alert(1)"), null);
    assert.equal(sanitizeAttachmentUrl("data:text/html,<script>alert(1)</script>"), null);
  });

  it("ปฏิเสธค่าว่างและข้อความที่ไม่ใช่ URL", () => {
    assert.equal(sanitizeAttachmentUrl(""), null);
    assert.equal(sanitizeAttachmentUrl("   "), null);
    assert.equal(sanitizeAttachmentUrl("example.com/a.pdf"), null);
    assert.equal(sanitizeAttachmentUrl("/board/123"), null);
  });
});

describe("attachmentKindForUpload", () => {
  it("ดู mime type ก่อน", () => {
    assert.equal(attachmentKindForUpload("noname", "image/png"), "IMAGE");
    assert.equal(attachmentKindForUpload("report.png", "application/pdf"), "FILE");
  });

  it("ไม่มี mime type ก็เดาจากนามสกุล (ไม่สนตัวพิมพ์)", () => {
    assert.equal(attachmentKindForUpload("photo.JPG"), "IMAGE");
    assert.equal(attachmentKindForUpload("slides.pdf"), "FILE");
    assert.equal(attachmentKindForUpload("ไฟล์ไม่มีนามสกุล"), "FILE");
  });
});

describe("attachmentNameFromUrl", () => {
  it("ใช้ชื่อไฟล์ท้าย path ถ้ามี", () => {
    assert.equal(attachmentNameFromUrl("https://example.com/docs/slides.pdf"), "slides.pdf");
  });

  it("ไม่มี path ก็ใช้ชื่อโฮสต์", () => {
    assert.equal(attachmentNameFromUrl("https://example.com/"), "example.com");
  });
});

describe("isWithinAttachmentSizeLimit", () => {
  it("รับได้ถึง 4MB พอดี แต่เกินไป 1 byte ไม่รับ", () => {
    assert.equal(isWithinAttachmentSizeLimit(MAX_ATTACHMENT_BYTES), true);
    assert.equal(isWithinAttachmentSizeLimit(MAX_ATTACHMENT_BYTES + 1), false);
  });

  it("ไฟล์ว่างไม่นับ", () => {
    assert.equal(isWithinAttachmentSizeLimit(0), false);
  });
});

describe("formatFileSize", () => {
  it("เปลี่ยนหน่วยตามขนาด", () => {
    assert.equal(formatFileSize(512), "512 B");
    assert.equal(formatFileSize(2048), "2.0 KB");
    assert.equal(formatFileSize(MAX_ATTACHMENT_BYTES), "4.0 MB");
  });
});
