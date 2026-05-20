#!/usr/bin/env node
/**
 * For every active campaign, find Contacts that don't yet have an
 * OutreachEmail row for step 1, draft personalized content via Gemini,
 * and insert them as `status="pending"` (ready for the send batch).
 *
 * Also handles follow-up steps: if a step-1 email is older than the next
 * step's `delayDays` AND we don't yet have a reply (status hasn't moved
 * to "replied" / "bounced" / "complaint"), draft the follow-up.
 *
 * Limits per run:
 *   --limit <N>       max drafts to create this run (default 30)
 *   --campaign <id>   restrict to one campaign
 *
 * Env required: DATABASE_URL, GEMINI_API_KEY
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const campaignArg = args.indexOf("--campaign");
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 30;
const CAMPAIGN_ID = campaignArg !== -1 ? args[campaignArg + 1] : null;

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY missing in env");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing in env");
  process.exit(1);
}

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an expert cold email copywriter for Sienovo, a Chinese company that exports edge AI computing devices (INT-AIBOX series) for industrial video analytics to international markets.

Rules:
1. Keep emails under 130 words. Busy operators don't read long emails.
2. Personalize using the recipient's title, company, and industry.
3. No salesy buzzwords ("revolutionary", "game-changing", "synergy", "best-in-class").
4. Lead with their problem, not our product.
5. One clear CTA: a 15-minute discovery call.
6. Sound human. Write like a real person, contractions OK.
7. Follow-ups should briefly reference the previous email.
8. STOP at the call-to-action. DO NOT write a sign-off ("Best,", "Thanks,", "Regards,") and DO NOT write the sender's name. DO NOT write a P.S. line. The signature block, contact details, and unsubscribe note will be appended by code after your output. Your <html> output should end with the CTA paragraph.

About Sienovo INT-AIBOX:
- Edge AI compute device, 7.2 TOPS INT8, 8-channel HD video, fanless industrial-grade.
- 40+ pre-loaded algorithms (safety helmet, smoking detection, intrusion, license plate, fire, PPE).
- Real deployments: gas stations (smoking/phone-use detection), construction sites, retail loss prevention.`;

// Deterministic signature appended to every email so name, email, and the
// website always render correctly. Replaces whatever sign-off the model
// might have produced (defense in depth against rule-following slips).
const SIGNATURE_HTML = `
<p>Best,</p>
<p>Leo from Sienovo</p>
<p style="font-size:12px;color:#666;line-height:1.5">
  <a href="https://intl.sienovo.cn" style="color:#666">intl.sienovo.cn</a> &middot;
  <a href="mailto:collin.liu@sienovo.cn" style="color:#666">collin.liu@sienovo.cn</a>
</p>
<p style="font-size:11px;color:#999;line-height:1.4">P.S. Not the right contact? Reply with "remove" and I won't email again.</p>`.trim();

async function geminiDraft(contact, campaign, step, prevSubject) {
  const lines = [SYSTEM_PROMPT];
  if (campaign.productFocus) lines.push(`\nProduct focus: ${campaign.productFocus}`);
  if (campaign.aiContext) lines.push(`Additional context: ${campaign.aiContext}`);
  lines.push(`\nSender name: ${campaign.senderName}`);

  lines.push(`\nRecipient:`);
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  if (name) lines.push(`- Name: ${name}`);
  if (contact.jobTitle) lines.push(`- Title: ${contact.jobTitle}`);
  if (contact.company) lines.push(`- Company: ${contact.company}`);
  if (contact.industry) lines.push(`- Industry: ${contact.industry}`);
  if (contact.city || contact.country)
    lines.push(
      `- Location: ${[contact.city, contact.country].filter(Boolean).join(", ")}`,
    );
  if (contact.companySize) lines.push(`- Company size: ${contact.companySize}`);

  lines.push(`\nThis is step ${step.stepOrder} of the sequence.`);
  if (step.subject) lines.push(`Subject direction: ${step.subject}`);
  if (step.promptHint) lines.push(`Style instruction: ${step.promptHint}`);
  if (prevSubject)
    lines.push(`Previous email subject was: "${prevSubject}" — reference it naturally.`);

  lines.push(
    `\nReturn ONLY JSON:\n{ "subject": "...", "html": "<p>opening paragraph</p><p>middle paragraph</p><p>CTA paragraph</p>" }\n\nThe html field must end at the CTA. No sign-off, no name, no contact details, no P.S. — those are appended programmatically after your output.`,
  );

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: lines.join("\n") }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]);
    if (!parsed.subject || !parsed.html) return null;
    parsed.html = normalizeSignoff(parsed.html);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Defensive post-processor: strip whatever sign-off / signature / P.S. the
 * model wrote (it shouldn't, per the prompt, but rule-following on style
 * is unreliable) and append our canonical SIGNATURE_HTML so every email
 * has the same name + intl.sienovo.cn link + collin.liu@sienovo.cn + opt-out.
 */
function normalizeSignoff(html) {
  let body = html.trim();

  // Drop trailing <p> elements that look like a sign-off, signature line,
  // or P.S. block. The patterns require the suspect content to start the
  // paragraph (after optional whitespace) — body sentences mentioning
  // these keywords mid-text are safe.
  const SIGNATURE_LIKE =
    /^<p[^>]*>\s*(Best|Thanks|Thank you|Regards|Cheers|Sincerely|Kind regards|Warm regards|Yours)\s*[,.]/i;
  const NAME_LIKE = /^<p[^>]*>\s*(Leo from Sienovo|Leo,|leo@|leo\.liu|intl\.sienovo)/i;
  const PS_LIKE = /^<p[^>]*>\s*P\.?\s*S\.?[\s.:]/i;
  const MIN_BODY_TEXT = 60; // chars of plain text — guard against over-stripping

  for (let i = 0; i < 6; i++) {
    const m = body.match(/(<p[^>]*>[\s\S]*?<\/p>)\s*$/);
    if (!m) break;
    const lastP = m[1];
    if (
      !SIGNATURE_LIKE.test(lastP) &&
      !NAME_LIKE.test(lastP) &&
      !PS_LIKE.test(lastP)
    ) {
      break;
    }
    const trimmed = body.slice(0, -lastP.length).trim();
    const trimmedTextLen = trimmed.replace(/<[^>]+>/g, "").trim().length;
    if (trimmedTextLen < MIN_BODY_TEXT) {
      // Stripping would leave an empty body — bail and keep the AI's
      // sign-off rather than ship a signature-only email.
      break;
    }
    body = trimmed;
  }

  return `${body}\n${SIGNATURE_HTML}`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const campaigns = CAMPAIGN_ID
  ? await client.query(
      `SELECT * FROM "OutreachCampaign" WHERE id = $1 AND status = 'active'`,
      [CAMPAIGN_ID],
    )
  : await client.query(
      `SELECT * FROM "OutreachCampaign" WHERE status = 'active'`,
    );

if (campaigns.rows.length === 0) {
  console.log("No active campaigns");
  await client.end();
  process.exit(0);
}

const totals = { drafted: 0, skipped: 0, failed: 0 };

outer: for (const campaign of campaigns.rows) {
  if (totals.drafted >= LIMIT) break;

  const stepsRes = await client.query(
    `SELECT * FROM "OutreachStep" WHERE "campaignId" = $1 ORDER BY "stepOrder" ASC`,
    [campaign.id],
  );
  const steps = stepsRes.rows;
  if (steps.length === 0) continue;

  // Step 1: contacts in this campaign that have no email yet
  const step1 = steps.find((s) => s.stepOrder === 1);
  if (step1) {
    const candidates = await client.query(
      `SELECT c.* FROM "Contact" c
       WHERE c.source = 'apollo-outbound'
         AND c."isLead" = true
         AND NOT EXISTS (
           SELECT 1 FROM "OutreachEmail" oe
           WHERE oe."contactId" = c.id AND oe."campaignId" = $1
         )
       ORDER BY c."createdAt" ASC
       LIMIT $2`,
      [campaign.id, LIMIT - totals.drafted],
    );

    for (const contact of candidates.rows) {
      if (totals.drafted >= LIMIT) break outer;
      console.log(`  Drafting step 1 → ${contact.email}`);
      const draft = await geminiDraft(contact, campaign, step1, null);
      if (!draft) {
        totals.failed++;
        continue;
      }

      await client.query(
        `INSERT INTO "OutreachEmail" (
           id, "campaignId", "stepId", "contactId", subject, "htmlContent",
           status, "createdAt", "updatedAt"
         )
         VALUES (
           'oe' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
           $1, $2, $3, $4, $5, 'pending', NOW(), NOW()
         )`,
        [campaign.id, step1.id, contact.id, draft.subject, draft.html],
      );
      totals.drafted++;
    }
  }

  // Steps 2..N: send follow-up if the previous step is "sent" and delayDays
  // have elapsed and we haven't yet drafted/sent this step.
  for (let i = 1; i < steps.length && totals.drafted < LIMIT; i++) {
    const step = steps[i];
    const prevStep = steps[i - 1];

    const due = await client.query(
      `SELECT c.*, prev.subject AS prev_subject, prev."sentAt" AS prev_sent_at
       FROM "OutreachEmail" prev
       JOIN "Contact" c ON c.id = prev."contactId"
       WHERE prev."campaignId" = $1
         AND prev."stepId" = $2
         AND prev.status = 'sent'
         AND prev."sentAt" < NOW() - ($3::int * INTERVAL '1 day')
         AND NOT EXISTS (
           SELECT 1 FROM "OutreachEmail" next
           WHERE next."contactId" = c.id
             AND next."campaignId" = $1
             AND next."stepId" = $4
         )
         AND NOT EXISTS (
           SELECT 1 FROM "OutreachEmail" rep
           WHERE rep."contactId" = c.id
             AND rep."campaignId" = $1
             AND rep.status IN ('replied','bounced','hard_bounced','complaint','unsubscribed')
         )
       ORDER BY prev."sentAt" ASC
       LIMIT $5`,
      [campaign.id, prevStep.id, step.delayDays, step.id, LIMIT - totals.drafted],
    );

    for (const row of due.rows) {
      if (totals.drafted >= LIMIT) break outer;
      console.log(`  Drafting step ${step.stepOrder} → ${row.email}`);
      const draft = await geminiDraft(row, campaign, step, row.prev_subject);
      if (!draft) {
        totals.failed++;
        continue;
      }

      await client.query(
        `INSERT INTO "OutreachEmail" (
           id, "campaignId", "stepId", "contactId", subject, "htmlContent",
           status, "createdAt", "updatedAt"
         )
         VALUES (
           'oe' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
           $1, $2, $3, $4, $5, 'pending', NOW(), NOW()
         )`,
        [campaign.id, step.id, row.id, draft.subject, draft.html],
      );
      totals.drafted++;
    }
  }
}

console.log(`\n--- Summary ---`);
console.log(`Drafted:  ${totals.drafted}`);
console.log(`Failed:   ${totals.failed}`);
await client.end();
