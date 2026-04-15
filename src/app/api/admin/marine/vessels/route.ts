import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import crypto from "crypto";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const vessels = await prisma.vessel.findMany({
    include: {
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(vessels);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { deviceId, name, type } = body;

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  const secretKey = crypto.randomBytes(16).toString("hex");

  const vessel = await prisma.vessel.create({
    data: {
      deviceId,
      name: name || null,
      type: type || "bait-boat",
      secretKey,
    },
  });

  return NextResponse.json(vessel, { status: 201 });
}
