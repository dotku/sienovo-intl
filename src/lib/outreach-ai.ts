import { trackApiUsage } from "@/lib/api-usage";

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an expert cold email copywriter for Sienovo, a China-based company that exports industrial edge AI products (INT-AIBOX series) to international markets.

Rules:
1. Keep emails under 150 words. Busy people don't read long emails.
2. Personalize based on the recipient's title, company, and industry — reference their specific use case.
3. Never use salesy buzzwords ("revolutionary", "game-changing", "synergy").
4. Lead with the recipient's problem, not our product.
5. One clear call to action: typically a 15-minute call.
6. Sound human. Write like a real person, not a template.
7. For follow-ups, reference the previous email naturally. Don't be pushy.
8. Write the email in English unless the recipient's country suggests otherwise (e.g. Chinese for China/Taiwan).

About Sienovo INT-AIBOX:
- Edge AI computing device with 7.2 TOPS INT8 computing power
- Processes 8 channels of HD video simultaneously
- 40+ built-in AI algorithms (safety, detection, recognition)
- Industrial-grade: fanless, -20°C to +60°C, IP41
- Use cases: manufacturing quality control, warehouse safety, smart retail, traffic monitoring`;

interface ContactInfo {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  jobTitle?: string | null;
  company?: string | null;
  industry?: string | null;
  city?: string | null;
  country?: string | null;
  companySize?: string | null;
  companyWebsite?: string | null;
}

interface CampaignContext {
  productFocus?: string | null;
  aiContext?: string | null;
  senderName: string;
}

interface StepContext {
  stepOrder: number;
  subject?: string | null;
  promptHint?: string | null;
}

interface PrevEmail {
  subject: string;
}

export async function generateOutreachEmail(
  contact: ContactInfo,
  campaign: CampaignContext,
  step: StepContext,
  prevEmail?: PrevEmail | null
): Promise<{ subject: string; html: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const lines: string[] = [SYSTEM_PROMPT];

  if (campaign.productFocus) lines.push(`\nProduct focus: ${campaign.productFocus}`);
  if (campaign.aiContext) lines.push(`Additional context: ${campaign.aiContext}`);

  lines.push(`\nSender name: ${campaign.senderName}`);
  lines.push(`\n---\n\nGenerate a cold email for this recipient:`);
  lines.push(`- Name: ${contact.firstName || ""} ${contact.lastName || ""}`.trim());
  lines.push(`- Email: ${contact.email}`);
  if (contact.jobTitle) lines.push(`- Title: ${contact.jobTitle}`);
  if (contact.company) lines.push(`- Company: ${contact.company}`);
  if (contact.industry) lines.push(`- Industry: ${contact.industry}`);
  if (contact.city || contact.country) lines.push(`- Location: ${[contact.city, contact.country].filter(Boolean).join(", ")}`);
  if (contact.companySize) lines.push(`- Company Size: ${contact.companySize}`);
  if (contact.companyWebsite) lines.push(`- Company Website: ${contact.companyWebsite}`);

  lines.push(`\nThis is step ${step.stepOrder} of the email sequence.`);
  if (step.promptHint) lines.push(`Instruction: ${step.promptHint}`);
  if (step.subject) lines.push(`Subject line direction: ${step.subject}`);
  if (prevEmail) lines.push(`This is a follow-up. The previous email subject was: "${prevEmail.subject}"`);

  lines.push(`\nReturn ONLY a JSON object:\n{ "subject": "the email subject line", "html": "the email body as simple HTML (use <p> tags, sign off with sender name)" }`);

  const prompt = lines.join("\n");

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      await trackApiUsage("gemini", "outreach_generate", false);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    await trackApiUsage("gemini", "outreach_generate", true);

    return {
      subject: parsed.subject || "Introduction from Sienovo",
      html: parsed.html || parsed.body || "",
    };
  } catch {
    await trackApiUsage("gemini", "outreach_generate", false);
    return null;
  }
}
