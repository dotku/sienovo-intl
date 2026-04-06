import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { getGoogleAccessToken } from "@/lib/google-token";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "reauth", redirectUrl: "/api/admin/google/authorize" },
      { status: 401 }
    );
  }

  // Fetch Google contacts
  const contacts: Array<{
    email: string;
    name: string;
    company: string;
    title: string;
    phone: string;
  }> = [];
  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields:
        "names,emailAddresses,organizations,phoneNumbers",
      pageSize: "100",
    });
    if (nextPageToken) params.set("pageToken", nextPageToken);

    const res = await fetch(
      `https://people.googleapis.com/v1/people/me/connections?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) break;

    const data = await res.json();
    for (const person of data.connections || []) {
      const email = person.emailAddresses?.[0]?.value;
      if (!email) continue;

      contacts.push({
        email,
        name:
          person.names?.[0]?.displayName || "",
        company:
          person.organizations?.[0]?.name || "",
        title:
          person.organizations?.[0]?.title || "",
        phone:
          person.phoneNumbers?.[0]?.value || "",
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  // Sync contacts to database and Brevo
  let synced = 0;
  let skipped = 0;

  for (const contact of contacts) {
    try {
      const firstName = contact.name.split(" ")[0] || "";
      const lastName = contact.name.split(" ").slice(1).join(" ") || "";

      // Upsert to our database
      await prisma.contact.upsert({
        where: { email: contact.email },
        update: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          company: contact.company || undefined,
          jobTitle: contact.title || undefined,
          phone: contact.phone || undefined,
          isLead: true,
        },
        create: {
          email: contact.email,
          firstName,
          lastName,
          company: contact.company,
          jobTitle: contact.title,
          phone: contact.phone,
          source: "google",
          isLead: true,
        },
      });

      // Push to Brevo
      const brevoApiKey = process.env.BREVO_API_KEY;
      if (brevoApiKey) {
        await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: contact.email,
            attributes: {
              FIRSTNAME: firstName,
              LASTNAME: lastName,
              COMPANY: contact.company,
              JOB_TITLE: contact.title,
            },
            listIds: [5],
            updateEnabled: true,
          }),
        });
      }

      synced++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    total: contacts.length,
    synced,
    skipped,
  });
}
