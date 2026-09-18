import { z } from "zod";
import { sanitizeAttachmentUrl } from "./attachments";

const text = z.string().trim().min(1).max(200);
const ids = z.array(z.string().min(1)).max(200).transform((values) => [...new Set(values)]);
export const cardCreateSchema = z.object({
  requestId: z.uuid(),
  listId: z.string().min(1),
  title: text,
  description: z.string().trim().max(20000),
  dueDate: z.union([z.literal(""), z.iso.date()]),
  priorityId: z.string(),
  labelIds: ids,
  assigneeIds: ids,
  checklists: z.array(z.object({
    title: text,
    items: z.array(z.object({ content: text, isCompleted: z.boolean() })).max(200),
  })).max(50),
  links: z.array(z.string().max(4000).transform((value, ctx) => {
    const url = sanitizeAttachmentUrl(value);
    if (!url) { ctx.addIssue({ code: "custom", message: "ใช้ลิงก์ http หรือ https เท่านั้น" }); return z.NEVER; }
    return url;
  })).max(100),
  comment: z.string().trim().max(10000),
});

export function parseCardCreate(formData: FormData) {
  let details: unknown;
  try { details = JSON.parse(String(formData.get("details") ?? "{}")); }
  catch { return cardCreateSchema.safeParse(null); }
  return cardCreateSchema.safeParse({
    ...(typeof details === "object" && details !== null ? details : {}),
    requestId: formData.get("requestId"), listId: formData.get("listId"),
    title: formData.get("title"), description: formData.get("description") ?? "",
    dueDate: formData.get("dueDate") ?? "", priorityId: formData.get("priorityId") ?? "",
    comment: formData.get("comment") ?? "",
  });
}
