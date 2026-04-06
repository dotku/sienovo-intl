import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { service, target } = (await req.json()) as {
    service: string;
    target: number;
  };

  if (!service || target == null || target < 0) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const existing = await prisma.apiUsage.count({
    where: { service, createdAt: { gte: startOfDay } },
  });

  const diff = target - existing;

  if (diff > 0) {
    // Add records to reach target
    await prisma.apiUsage.createMany({
      data: Array.from({ length: diff }, () => ({
        service,
        action: "manual_adjust",
        success: true,
      })),
    });
  } else if (diff < 0) {
    // Remove manual_adjust records first, then others if needed
    const toDelete = Math.abs(diff);
    const manualRecords = await prisma.apiUsage.findMany({
      where: { service, action: "manual_adjust", createdAt: { gte: startOfDay } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: toDelete,
    });

    const idsToDelete = manualRecords.map((r) => r.id);

    // If not enough manual records, also remove manual_fill records
    if (idsToDelete.length < toDelete) {
      const fillRecords = await prisma.apiUsage.findMany({
        where: { service, action: "manual_fill", createdAt: { gte: startOfDay } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: toDelete - idsToDelete.length,
      });
      idsToDelete.push(...fillRecords.map((r) => r.id));
    }

    if (idsToDelete.length > 0) {
      await prisma.apiUsage.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }
  }

  return NextResponse.json({ previous: existing, current: target });
}
