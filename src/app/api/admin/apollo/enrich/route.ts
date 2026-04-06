import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { enrichContact } from "@/lib/apollo";
import { pushToBrevo } from "@/lib/contacts-sync";

// GET: Preview enrichment data from Apollo (does NOT update database)
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { company: null },
        { company: "" },
        { jobTitle: null },
        { jobTitle: "" },
      ],
    },
    take: 20, // Batch limit to avoid API rate limits
  });

  const previews = [];

  for (const contact of contacts) {
    const data = await enrichContact(contact.email);
    if (data) {
      previews.push({
        contactId: contact.id,
        email: contact.email,
        current: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          company: contact.company,
          jobTitle: contact.jobTitle,
          industry: contact.industry,
          linkedinUrl: contact.linkedinUrl,
          city: contact.city,
          country: contact.country,
        },
        apollo: {
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          jobTitle: data.title,
          industry: data.industry,
          linkedinUrl: data.linkedinUrl,
          city: data.city,
          country: data.country,
          companySize: data.companySize,
          companyWebsite: data.companyWebsite,
        },
      });
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  return NextResponse.json({ previews, total: contacts.length });
}

// POST: Apply confirmed enrichments to database and sync
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { approvals } = body as {
    approvals: Array<{
      contactId: string;
      data: Record<string, string | null>;
    }>;
  };

  let updated = 0;

  for (const approval of approvals) {
    try {
      const contact = await prisma.contact.update({
        where: { id: approval.contactId },
        data: approval.data,
      });

      await pushToBrevo(contact);
      updated++;
    } catch {
      // Skip failed updates
    }
  }

  return NextResponse.json({ success: true, updated });
}
