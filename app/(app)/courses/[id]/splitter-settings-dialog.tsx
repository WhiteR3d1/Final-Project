"use client";

import { useActionState, useState, useTransition } from "react";
import { Modal } from "@/app/components/ui/modal";
import { SubmitButton } from "@/app/components/ui/buttons";
import {
  SPLITTER_DETAILS,
  SPLITTER_DETAIL_OPTIONS,
  SPLITTER_INSTRUCTIONS_MAX,
  SPLITTER_ITEMS_MAX,
  SPLITTER_ITEMS_MIN,
  type SplitterDetail,
  type SplitterSettings,
} from "@/lib/task-splitter-options";
import { saveSplitterSettingsAction, splitAssignmentAction, type AssignmentFormState } from "../actions";

const fieldBase =
  "border-line bg-panel-2 text-text placeholder:text-muted focus:border-accent rounded-lg border px-3 py-2 text-sm focus:outline-none";
const fieldClass = `${fieldBase} w-full`;
// แยกจาก fieldClass เพราะ w-full กับ w-20 ชนกัน แล้ว w-full ชนะ ช่องตัวเลขจะยืดเต็มบรรทัด
const numberClass = `${fieldBase} w-20 py-1.5`;

/** ปุ่มเปิดหน้าตั้งค่าตัวแตกงานของวิชา — dialog mount ใหม่ทุกครั้ง ค่าในฟอร์มจึงตรงกับที่บันทึกล่าสุด */
export function SplitterSettingsButton({
  courseId,
  settings,
  aiReady,
  className,
}: {
  courseId: string;
  settings: SplitterSettings;
  aiReady: boolean;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        ตั้งค่าตัวแตกงาน
      </button>
      {open && (
        <SplitterSettingsDialog
          courseId={courseId}
          settings={settings}
          aiReady={aiReady}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * ปรับจูนตัวแตกงานของวิชา — ทุกช่อง controlled (React 19 รีเซ็ตฟอร์มหลัง action)
 * "ลองแตกดู" ใช้ค่าในหน้านี้ที่ยังไม่ได้บันทึก ปรับแล้วลองซ้ำได้จนพอใจค่อยบันทึก
 */
function SplitterSettingsDialog({
  courseId,
  settings,
  aiReady,
  onClose,
}: {
  courseId: string;
  settings: SplitterSettings;
  aiReady: boolean;
  onClose: () => void;
}) {
  const [minItems, setMinItems] = useState(String(settings.minItems));
  const [maxItems, setMaxItems] = useState(String(settings.maxItems));
  const [detail, setDetail] = useState<SplitterDetail>(settings.detail);
  const [instructions, setInstructions] = useState(settings.instructions);
  const [learnFromPast, setLearnFromPast] = useState(settings.learnFromPast);
  // ช่องว่างกลายเป็น 0 แล้วให้ฝั่ง server บอกว่าผิด — ไม่แก้ค่าให้เงียบ ๆ
  const current = { minItems: Number(minItems), maxItems: Number(maxItems), detail, instructions, learnFromPast };

  const [state, action, pending] = useActionState<AssignmentFormState, FormData>(async (previous, formData) => {
    const result = await saveSplitterSettingsAction(previous, formData);
    if (result?.savedAt) onClose();
    return result;
  }, undefined);

  const [sampleTitle, setSampleTitle] = useState("เครื่องคิดเลขด้วย Python");
  const [sampleDescription, setSampleDescription] = useState("");
  const [trying, startTry] = useTransition();
  const [tryResult, setTryResult] = useState<{ items: string[] } | { error: string } | null>(null);
  const runTry = () => {
    startTry(async () => {
      setTryResult(
        await splitAssignmentAction(courseId, { title: sampleTitle, description: sampleDescription }, current)
      );
    });
  };

  return (
    <Modal open onClose={onClose} busy={pending} size="lg" title="ตั้งค่าตัวแตกงานด้วย AI">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="payload" value={JSON.stringify(current)} />

        <p className="text-muted text-xs leading-5">
          ปรับวิธีที่ AI (Typhoon) แตกงานของวิชานี้ ใช้กับปุ่ม &ldquo;✨ แตกงานย่อยด้วย AI&rdquo; ในหน้าต่างสร้างงาน
        </p>
        <p className="bg-warn/10 text-warn rounded-lg px-3 py-2 text-xs leading-5">
          ข้อความที่ส่งให้ Typhoon (ชื่องาน โจทย์ คำสั่งเพิ่มเติม และงานเก่าของวิชา) อาจถูกใช้พัฒนาโมเดล
          อย่าใส่ข้อมูลส่วนตัวของนักศึกษา
        </p>

        <fieldset>
          <legend className="text-muted mb-1.5 text-xs">จำนวนงานย่อย</legend>
          {/* fieldset เป็น flex container ไม่ได้ดีในทุกเบราว์เซอร์ — จัดแถวด้วย div ข้างใน */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text text-sm">ตั้งแต่</span>
            <input
              type="number"
              min={SPLITTER_ITEMS_MIN}
              max={SPLITTER_ITEMS_MAX}
              value={minItems}
              onChange={(event) => setMinItems(event.target.value)}
              aria-label="จำนวนงานย่อยต่ำสุด"
              className={numberClass}
            />
            <span className="text-text text-sm">ถึง</span>
            <input
              type="number"
              min={SPLITTER_ITEMS_MIN}
              max={SPLITTER_ITEMS_MAX}
              value={maxItems}
              onChange={(event) => setMaxItems(event.target.value)}
              aria-label="จำนวนงานย่อยสูงสุด"
              className={numberClass}
            />
            <span className="text-text text-sm">ข้อ</span>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-muted mb-1.5 text-xs">ความละเอียด</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SPLITTER_DETAILS.map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2 ${
                  detail === value ? "border-accent bg-accent/10" : "border-line hover:bg-panel-2"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="splitter-detail"
                    value={value}
                    checked={detail === value}
                    onChange={() => setDetail(value)}
                  />
                  <span className="text-text text-sm font-medium">{SPLITTER_DETAIL_OPTIONS[value].label}</span>
                </span>
                <span className="text-muted text-[11px] leading-4">{SPLITTER_DETAIL_OPTIONS[value].hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-xs">
            คำสั่งเพิ่มเติม ({instructions.length}/{SPLITTER_INSTRUCTIONS_MAX})
          </span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={SPLITTER_INSTRUCTIONS_MAX}
            rows={3}
            placeholder="เช่น ทุกงานต้องมีข้อเขียนเทสต์และ README / ใช้คำที่นักศึกษาปี 1 เข้าใจ / ข้อสุดท้ายต้องเป็นการส่งงานบน GitHub"
            className={`${fieldClass} resize-y`}
          />
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={learnFromPast}
            onChange={(event) => setLearnFromPast(event.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="text-text">เรียนรู้จากงานเก่าในวิชานี้</span>
            <span className="text-muted block text-[11px]">
              ส่งงานล่าสุดที่มีงานย่อยไม่เกิน 3 งานให้ AI เป็นตัวอย่าง ยิ่งแตกงานเองหรือแก้ผลของ AI บ่อย AI ยิ่งแตกงานตามสไตล์คุณ
            </span>
          </span>
        </label>

        <section className="border-line flex flex-col gap-2 rounded-xl border p-3">
          <h3 className="text-text text-sm font-medium">ลองแตกดู</h3>
          <p className="text-muted text-[11px]">ใช้ค่าในหน้านี้ที่ยังไม่ได้บันทึก — ไม่สร้างงานจริง</p>
          <input
            type="text"
            value={sampleTitle}
            onChange={(event) => setSampleTitle(event.target.value)}
            maxLength={200}
            aria-label="ชื่องานตัวอย่าง"
            placeholder="ชื่องานตัวอย่าง"
            className={`${fieldClass} py-1.5`}
          />
          <input
            type="text"
            value={sampleDescription}
            onChange={(event) => setSampleDescription(event.target.value)}
            maxLength={2000}
            aria-label="โจทย์ตัวอย่าง"
            placeholder="โจทย์ (ไม่บังคับ)"
            className={`${fieldClass} py-1.5`}
          />
          <button
            type="button"
            onClick={runTry}
            disabled={!aiReady || !sampleTitle.trim() || trying}
            title={aiReady ? undefined : "ต้องตั้งค่า TYPHOON_API_KEY ก่อน"}
            className="border-info/40 text-info hover:bg-info/10 self-start rounded-lg border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            {trying ? "AI กำลังแตกงาน..." : "✨ ลองแตกดู"}
          </button>
          {!aiReady && <p className="text-muted text-[11px]">ใช้ AI ได้เมื่อผู้ดูแลตั้งค่า TYPHOON_API_KEY แล้ว</p>}
          {tryResult &&
            ("error" in tryResult ? (
              <p className="text-danger text-xs">{tryResult.error}</p>
            ) : (
              <ol className="text-text flex list-decimal flex-col gap-1 pl-5 text-sm">
                {tryResult.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            ))}
        </section>

        {state?.error && <p className="text-danger text-xs">{state.error}</p>}

        <footer className="border-line flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="border-line text-muted hover:text-text rounded-lg border px-4 py-1.5 text-sm"
          >
            ยกเลิก
          </button>
          <SubmitButton
            pendingLabel="กำลังบันทึก..."
            className="bg-accent text-accent-ink rounded-lg px-5 py-1.5 text-sm font-medium hover:brightness-110"
          >
            บันทึกการตั้งค่า
          </SubmitButton>
        </footer>
      </form>
    </Modal>
  );
}
