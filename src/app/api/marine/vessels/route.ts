import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public API: list online vessels (for controller app to discover boats)
export async function GET() {
  const vessels = await prisma.vessel.findMany({
    where: { isOnline: true },
    select: {
      id: true,
      deviceId: true,
      name: true,
      type: true,
      lastLat: true,
      lastLng: true,
      lastBattery: true,
      lastSignal: true,
      lastBaitLevel: true,
      lastSeenAt: true,
      isOnline: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  // Map to the format expected by the controller app
  const boats = vessels.map((v) => ({
    id: v.deviceId,
    name: v.name,
    type: v.type,
    lat: v.lastLat ?? 0,
    lng: v.lastLng ?? 0,
    battery: v.lastBattery ?? 0,
    signal: v.lastSignal ?? 0,
    baitLevel: v.lastBaitLevel ?? 100,
    isOnline: v.isOnline,
    lastSeen: v.lastSeenAt,
  }));

  return NextResponse.json({ boats, count: boats.length });
}
