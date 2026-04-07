import { getUser } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import DashboardOverview from "./DashboardOverview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) return null;

  const [openCount, resolvedCount, recentTickets] = await Promise.all([
    prisma.ticket.count({
      where: { userId: user.id, status: { in: ["open", "in_progress"] } },
    }),
    prisma.ticket.count({
      where: { userId: user.id, status: "resolved" },
    }),
    prisma.ticket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, subject: true, status: true, createdAt: true },
    }),
  ]);

  return (
    <DashboardOverview
      userName={user.name || ""}
      openCount={openCount}
      resolvedCount={resolvedCount}
      recentTickets={recentTickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
