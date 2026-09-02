import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Action รับ body ได้ 1MB เป็นค่าเริ่มต้น ซึ่งน้อยกว่าเพดานไฟล์แนบ (4MB)
    // ตั้งเผื่อ overhead ของ multipart แต่ยังต่ำกว่าลิมิต request ~4.5MB ของ Vercel
    serverActions: { bodySizeLimit: "4.4mb" },
  },
};

export default nextConfig;
