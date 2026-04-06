import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  let synced = 0;
  let skipped = 0;

  // Pull from both lists
  for (const listId of [5, 6]) {
    let offset = 0;
    const limit = 50;

    while (true) {
      const res = await fetch(
        `https://api.brevo.com/v3/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}`,
        { headers: { "api-key": apiKey } }
      );

      if (!res.ok) break;

      const data = await res.json();
      const contacts = data.contacts || [];
      if (contacts.length === 0) break;

      for (const contact of contacts) {
        try {
          const attr = contact.attributes || {};
          await prisma.contact.upsert({
            where: { email: contact.email },
            update: {
              firstName: attr.FIRSTNAME || undefined,
              lastName: attr.LASTNAME || undefined,
              company: attr.COMPANY || undefined,
              jobTitle: attr.JOB_TITLE || undefined,
              industry: attr.INDUSTRY || undefined,
              linkedinUrl: attr.LINKEDIN || undefined,
              city: attr.CITY || undefined,
              country: attr.COUNTRY || undefined,
              message: attr.MESSAGE || undefined,
              isLead: contact.listIds?.includes(5) ? true : undefined,
              isNewsletter: contact.listIds?.includes(6) ? true : undefined,
            },
            create: {
              email: contact.email,
              firstName: attr.FIRSTNAME || null,
              lastName: attr.LASTNAME || null,
              company: attr.COMPANY || null,
              jobTitle: attr.JOB_TITLE || null,
              industry: attr.INDUSTRY || null,
              linkedinUrl: attr.LINKEDIN || null,
              city: attr.CITY || null,
              country: attr.COUNTRY || null,
              message: attr.MESSAGE || null,
              source: "brevo",
              isLead: contact.listIds?.includes(5) || false,
              isNewsletter: contact.listIds?.includes(6) || false,
            },
          });
          synced++;
        } catch {
          skipped++;
        }
      }

      offset += limit;
      if (contacts.length < limit) break;
    }
  }

  return NextResponse.json({ success: true, synced, skipped });
}
