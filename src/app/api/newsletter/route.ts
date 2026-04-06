import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Save to our database
    await prisma.contact.upsert({
      where: { email },
      update: { isNewsletter: true },
      create: { email, source: "newsletter", isNewsletter: true },
    });

    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // List 6: "Sienovo Newsletter" (separate from list 5: "Sienovo AIBOX Leads")
    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        attributes: {
          NEWSLETTER: true,
        },
        listIds: [6],
        updateEnabled: true,
      }),
    });

    if (!contactRes.ok) {
      const err = await contactRes.json();
      if (err.code === "duplicate_parameter") {
        return NextResponse.json({
          success: true,
          message: "Already subscribed",
        });
      }
      return NextResponse.json(
        { error: "Failed to subscribe" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
