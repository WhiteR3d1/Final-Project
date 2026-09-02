"use client";

/**
 * ช่องเลือกสีที่บอร์ดกับคอลัมน์ใช้ร่วมกัน — จานสีมีชุดเดียวจะได้ไม่ค่อย ๆ เพี้ยนออกจากกัน
 * ค่าที่ได้ถูกเก็บลง DB (ไม่ใช่ token ของธีม) จึงใส่ผ่าน style ตามข้อยกเว้นใน CLAUDE.md
 */
export const PRESET_COLORS = [
  "#8b7cff",
  "#4dabff",
  "#2fd4a0",
  "#b6f36b",
  "#ffcc4d",
  "#ff8f6b",
  "#ff6b6b",
];

export function ColorPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="color"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="เลือกสีเอง"
        className="border-line bg-panel-2 h-8 w-10 shrink-0 cursor-pointer rounded-lg border"
      />
      {PRESET_COLORS.map((preset) => {
        const isActive = value.toLowerCase() === preset.toLowerCase();
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            aria-label={`ใช้สี ${preset}`}
            aria-pressed={isActive}
            style={{ backgroundColor: preset }}
            className={`h-6 w-6 rounded-full transition ${
              isActive
                ? "ring-text scale-110 ring-2 ring-offset-2 ring-offset-[var(--panel)]"
                : "opacity-70 hover:opacity-100"
            }`}
          />
        );
      })}
    </div>
  );
}
