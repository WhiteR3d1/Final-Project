import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { accessibleBoardWhere } from "@/lib/boards";
import { Panel } from "@/app/components/ui/panel";
import { TaskRow } from "@/app/components/dashboard/task-row";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // ค้นเฉพาะบอร์ดที่ผู้ใช้เข้าถึงได้เท่านั้น (สิทธิ์เช็คที่ query ไม่ใช่ที่ UI)
  const cards = query
    ? await prisma.card.findMany({
        where: {
          list: { board: accessibleBoardWhere(user.id) },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          priority: { select: { name: true, color: true } },
          list: {
            select: { name: true, board: { select: { id: true, name: true, color: true } } },
          },
        },
        orderBy: [{ isCompleted: "asc" }, { updatedAt: "desc" }],
        take: 50,
      })
    : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-text text-xl font-semibold">ผลการค้นหา</h1>
        {query && (
          <p className="text-muted mt-1 text-sm">
            คำค้น &ldquo;{query}&rdquo; — เจอ {cards.length} งาน
          </p>
        )}
      </div>

      <Panel>
        {!query ? (
          <p className="text-muted py-8 text-center text-sm">
            พิมพ์คำค้นในช่องด้านบนเพื่อค้นหางานจากทุกบอร์ดของคุณ
          </p>
        ) : cards.length === 0 ? (
          <p className="text-muted py-8 text-center text-sm">
            ไม่พบงานที่ตรงกับ &ldquo;{query}&rdquo;
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {cards.map((card) => (
              <li key={card.id}>
                <TaskRow card={card} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
