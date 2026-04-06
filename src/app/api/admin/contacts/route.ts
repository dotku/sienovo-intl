import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { pushToBrevo, pushToGoogle } from "@/lib/contacts-sync";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const contacts = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
  });
  // Explicitly map to ensure id is serialized
  const result = contacts.map((c) => ({
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    jobTitle: c.jobTitle,
    industry: c.industry,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    city: c.city,
    country: c.country,
    companySize: c.companySize,
    companyWebsite: c.companyWebsite,
    message: c.message,
    source: c.source,
    isLead: c.isLead,
    isNewsletter: c.isNewsletter,
    companyId: c.companyId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { email, id: _id, createdAt: _ca, updatedAt: _ua, ...data } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const contact = await prisma.contact.upsert({
    where: { email },
    update: data,
    create: { email, ...data },
  });

  // Push to external services
  await Promise.allSettled([
    pushToBrevo(contact),
    pushToGoogle(contact),
  ]);

  return NextResponse.json(contact, { status: 201 });
}
