import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCardCreate } from "./card-create";

function form(details: Record<string, unknown> = {}) {
  const data = new FormData();
  data.set("requestId", "4c6f3c04-3efe-4a43-8c88-66c3c7911a25");
  data.set("listId", "list-1");
  data.set("title", "  งานใหม่  ");
  data.set("details", JSON.stringify({ labelIds: [], assigneeIds: [], checklists: [], links: [], ...details }));
  return data;
}

test("accepts a title-only card and normalizes duplicate selections", () => {
  const result = parseCardCreate(form({ labelIds: ["label-1", "label-1"] }));
  assert.ok(result.success);
  assert.equal(result.data.title, "งานใหม่");
  assert.equal(result.data.description, "");
  assert.deepEqual(result.data.labelIds, ["label-1"]);
});

test("preserves checklist completion, multiple assignees, links and comment", () => {
  const data = form({ assigneeIds: ["owner", "member"], links: [" https://example.com/file "],
    checklists: [{ title: "งานย่อย", items: [{ content: "ทดสอบ", isCompleted: true }] }] });
  data.set("comment", "เริ่มงาน");
  data.set("dueDate", "2026-09-17");
  const result = parseCardCreate(data);
  assert.ok(result.success);
  assert.equal(result.data.checklists[0].items[0].isCompleted, true);
  assert.deepEqual(result.data.assigneeIds, ["owner", "member"]);
  assert.deepEqual(result.data.links, ["https://example.com/file"]);
  assert.equal(result.data.comment, "เริ่มงาน");
});

test("rejects malformed JSON, unsafe URLs, invalid dates and empty checklist items", () => {
  const malformed = form(); malformed.set("details", "{");
  assert.equal(parseCardCreate(malformed).success, false);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///test"]) {
    assert.equal(parseCardCreate(form({ links: [url] })).success, false);
  }
  const invalidDate = form(); invalidDate.set("dueDate", "2026-02-30");
  assert.equal(parseCardCreate(invalidDate).success, false);
  assert.equal(parseCardCreate(form({ checklists: [{ title: "Checklist", items: [{ content: " ", isCompleted: false }] }] })).success, false);
});

test("does not allow details JSON to override trusted form fields", () => {
  const data = form({ requestId: "invalid", title: "overridden", listId: "other-list" });
  const result = parseCardCreate(data);
  assert.ok(result.success);
  assert.equal(result.data.listId, "list-1");
  assert.equal(result.data.title, "งานใหม่");
});
