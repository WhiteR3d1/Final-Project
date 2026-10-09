/**
 * โครงหน้าระหว่างรอเซิร์ฟเวอร์ render — ไม่มีไฟล์นี้ คลิกเปลี่ยนหน้าแล้วจอจะนิ่งจนกว่าข้อมูลมาครบ
 * (sidebar อยู่ใน layout จึงค้างอยู่ เปลี่ยนแค่เนื้อหาตรงกลาง) ไม่มีข้อความ เพราะเป็นของชั่วคราว
 */
export default function AppLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-label="กำลังโหลด">
      <div className="flex flex-col gap-2">
        <div className="bg-panel-2 h-7 w-56 rounded-lg" />
        <div className="bg-panel-2 h-4 w-40 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="border-line bg-panel h-56 rounded-2xl border" />
        ))}
      </div>
      <div className="border-line bg-panel h-72 rounded-2xl border" />
    </div>
  );
}
