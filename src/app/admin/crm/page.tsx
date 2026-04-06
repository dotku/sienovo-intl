import { prisma } from "@/lib/prisma";
import CRMContactsList from "./CRMContactsList";

async function isGoogleConnected(): Promise<boolean> {
  try {
    const token = await prisma.setting.findUnique({
      where: { key: "google_access_token" },
    });
    return !!token;
  } catch {
    return false;
  }
}

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; error?: string }>;
}) {
  const params = await searchParams;
  const rawContacts = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
  });
  const contacts = rawContacts.map((c) => ({
    ...c,
    id: String(c.id),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
  const googleConnected = await isGoogleConnected();

  return (
    <CRMContactsList
      contacts={contacts}
      googleConnected={googleConnected}
      googleParam={params.google}
      errorParam={params.error}
    />
  );
}
