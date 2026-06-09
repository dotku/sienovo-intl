import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Where contact-form inquiries are emailed. Matches the address shown in the
// site footer.
const RECIPIENT = "collin.liu@sienovo.cn";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c),
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const company = String(body.company || "").trim();
    const phone = String(body.phone || "").trim();
    const message = String(body.message || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "A message is required" }, { status: 400 });
    }

    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ") || null;

    // Persist to the CRM. A contact-form submission is a warm lead.
    await prisma.contact.upsert({
      where: { email },
      update: {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(company ? { company } : {}),
        ...(phone ? { phone } : {}),
        message,
        isLead: true,
      },
      create: {
        email,
        firstName: firstName || null,
        lastName,
        company: company || null,
        phone: phone || null,
        message,
        source: "contact_form",
        isLead: true,
      },
    });

    // Notify the team (best-effort — the inquiry is already saved either way).
    if (process.env.RESEND_API_KEY) {
      const html = `
        <h2>New contact inquiry</h2>
        <p><strong>Name:</strong> ${escapeHtml(name || "—")}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(company || "—")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Sienovo Website <noreply@sienovo.cn>",
          to: [RECIPIENT],
          reply_to: email,
          subject: `New inquiry from ${name || email}`,
          html,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
