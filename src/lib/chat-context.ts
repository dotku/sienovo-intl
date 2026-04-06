import { prisma } from "@/lib/prisma";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";

export async function gatherContext(): Promise<string> {
  const [
    contactCount,
    leadCount,
    companyCount,
    knowledgeFileCount,
    recentContacts,
    companies,
    knowledgeFiles,
    apiUsageThisMonth,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { isLead: true } }),
    prisma.company.count(),
    prisma.knowledgeFile.count(),
    prisma.contact.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        jobTitle: true,
        industry: true,
        city: true,
        country: true,
        isLead: true,
        source: true,
      },
    }),
    prisma.company.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.knowledgeFile.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { name: true, mimeType: true, size: true, source: true },
    }),
    prisma.apiUsage.groupBy({
      by: ["service"],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  const sections: string[] = [];

  // Overview
  sections.push(`## Business Overview
- Total Contacts: ${contactCount}
- Leads: ${leadCount}
- Companies: ${companyCount}
- Knowledge Base Files: ${knowledgeFileCount}`);

  // API Usage
  if (apiUsageThisMonth.length > 0) {
    sections.push(`## API Usage This Month
${apiUsageThisMonth.map((u) => `- ${u.service}: ${u._count} calls`).join("\n")}`);
  }

  // Companies
  if (companies.length > 0) {
    sections.push(`## Companies
${companies
  .map(
    (c) =>
      `- ${c.name}${c.industry ? ` (${c.industry})` : ""}${c.country ? `, ${c.country}` : ""} — ${c._count.contacts} contacts${c.website ? ` — ${c.website}` : ""}${c.size ? ` — ${c.size}` : ""}`
  )
  .join("\n")}`);
  }

  // Recent Contacts
  if (recentContacts.length > 0) {
    sections.push(`## Recent Contacts
${recentContacts
  .map((c) => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
    const parts = [name];
    if (c.jobTitle) parts.push(c.jobTitle);
    if (c.company) parts.push(`@ ${c.company}`);
    if (c.industry) parts.push(`(${c.industry})`);
    if (c.city && c.country) parts.push(`${c.city}, ${c.country}`);
    if (c.isLead) parts.push("[LEAD]");
    if (c.source) parts.push(`source: ${c.source}`);
    return `- ${parts.join(" | ")}`;
  })
  .join("\n")}`);
  }

  // Knowledge Base
  if (knowledgeFiles.length > 0) {
    sections.push(`## Knowledge Base Files
${knowledgeFiles.map((f) => `- ${f.name} (${f.mimeType}, ${f.source})`).join("\n")}`);
  }

  return sections.join("\n\n");
}

export async function gatherRAGContext(userMessage: string): Promise<string> {
  try {
    const chunks = await retrieveRelevantChunks(userMessage, 5);
    if (chunks.length === 0) return "";

    const sections = chunks.map(
      (chunk, i) =>
        `### Source ${i + 1}: ${chunk.fileName} (relevance: ${(chunk.similarity * 100).toFixed(0)}%)\n${chunk.content}`
    );

    return `## Relevant Knowledge Base Content
The following excerpts from the knowledge base are relevant to the user's question. Use these to provide grounded answers. Cite the source file name when using this information.

${sections.join("\n\n")}`;
  } catch {
    return "";
  }
}
