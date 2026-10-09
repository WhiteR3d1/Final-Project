/** โครงบอร์ดระหว่างรอ — ขนาดคอลัมน์เท่าของจริง (w-72 + ความสูงเดียวกับ kanban-board) หน้าจะได้ไม่กระตุกตอนข้อมูลมา */
export default function BoardLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-label="กำลังโหลดบอร์ด">
      <div className="flex items-center gap-3">
        <div className="bg-panel-2 h-3 w-3 rounded-full" />
        <div className="bg-panel-2 h-7 w-48 rounded-lg" />
        <div className="bg-panel-2 ml-auto h-8 w-28 rounded-lg" />
      </div>
      <div className="border-line bg-panel h-24 rounded-2xl border" />
      <div className="bg-panel-2 h-9 w-full max-w-2xl rounded-lg" />
      <div className="flex h-[calc(100vh-20rem)] min-h-100 gap-4 overflow-hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-line bg-panel-2 flex h-full w-72 shrink-0 flex-col gap-2 rounded-2xl border p-3"
          >
            <div className="bg-panel h-7 w-32 rounded-full" />
            {Array.from({ length: 3 - (index % 2) }, (_, card) => (
              <div key={card} className="bg-panel h-20 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
