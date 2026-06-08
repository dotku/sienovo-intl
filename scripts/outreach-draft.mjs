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
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import FirecrawlApp from "@mendable/firecrawl-js";

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const campaignArg = args.indexOf("--campaign");
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 30;
const CAMPAIGN_ID = campaignArg !== -1 ? args[campaignArg + 1] : null;

// Bedrock is the primary drafter (better cold-email writing than Gemini Flash).
// Gemini stays as a fallback when Bedrock fails or AWS creds are missing.
// us. prefix = cross-region inference profile (works across all US regions).
const BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const bedrockReady = !!(
  process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE
);
const bedrockClient = bedrockReady
  ? new BedrockRuntimeClient({ region: AWS_REGION })
  : null;

// Firecrawl is used for per-contact prospect research before drafting.
// Optional — if the key is missing, drafts use only the Apollo enrichment
// already on the Contact row, which still works (this is the pre-upgrade
// behaviour).
const firecrawlReady = !!process.env.FIRECRAWL_API_KEY;
const firecrawl = firecrawlReady
  ? new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY })
  : null;

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
<p>Jay Lin</p>
<p style="font-size:12px;color:#666;line-height:1.5">
  <a href="https://intl.sienovo.cn" style="color:#666">intl.sienovo.cn</a> &middot;
  <a href="mailto:jay.lin@sienovo.cn" style="color:#666">jay.lin@sienovo.cn</a>
</p>
<p style="font-size:11px;color:#999;line-height:1.4">P.S. Not the right contact? Reply with "remove" and I won't email again.</p>`.trim();

// ── Prospect research (Firecrawl) ───────────────────────────────────────────
// Pull 3 recent insights about the contact's company so the drafter can
// open with something specific instead of "I noticed your company is in
// the convenience store space". Cost is ~$0.001-0.005 per query; at 30
// drafts/day this is well under $1/month even with no cache.
async function researchContact(contact) {
  if (!firecrawl) return null;
  if (!contact.company) return null;

  // Focused on the dimensions Sienovo's INT-AIBOX is built for: smoke/PPE
  // detection, loss prevention, intrusion, fire, safety. The OR-query
  // surfaces whichever angle the target has been talking about.
  const query =
    `"${contact.company}" ` +
    `(video analytics OR AI surveillance OR loss prevention OR ` +
    `safety detection OR smoke detection OR perimeter security)`;

  try {
    // Firecrawl v4 SDK groups results by source. Access `.web` directly —
    // touching `.data` on the result object throws "Results are grouped by
    // source" by design. Other source buckets (.news, .images) exist too
    // but for cold-email research the web results are what we want.
    const res = await firecrawl.search(query, { limit: 5 });
    const items = Array.isArray(res?.web) ? res.web : [];
    const insights = [];
    for (const r of items.slice(0, 5)) {
      const title = r.title || "";
      const snippet = (r.description || r.snippet || "").trim();
      if (!title && !snippet) continue;
      insights.push(`- ${title}${snippet ? `: ${snippet}` : ""}`.slice(0, 240));
      if (insights.length === 3) break;
    }
    return insights.length > 0 ? insights.join("\n") : null;
  } catch (err) {
    console.warn(`  ⚠ Firecrawl research failed: ${err.message}`);
    return null;
  }
}

// ── Prompt builder (shared by Bedrock + Gemini) ─────────────────────────────
function buildPromptText(contact, campaign, step, prevSubject, researchSummary) {
  const lines = [];
  if (campaign.productFocus) lines.push(`Product focus: ${campaign.productFocus}`);
  if (campaign.aiContext) lines.push(`Additional context: ${campaign.aiContext}`);
  lines.push(`Sender name: ${campaign.senderName}`);

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

  if (researchSummary) {
    lines.push(`\nRecent public context about ${contact.company}:`);
    lines.push(researchSummary);
    lines.push(
      `Use ONE concrete detail from the context above to ground the opening ` +
      `sentence (e.g. a recent initiative, partnership, or pain point). ` +
      `Do not list multiple. If nothing is genuinely relevant to ` +
      `Sienovo's video-analytics use cases, ignore it and rely on title/industry.`,
    );
  }

  lines.push(`\nThis is step ${step.stepOrder} of the sequence.`);
  if (step.subject) lines.push(`Subject direction: ${step.subject}`);
  if (step.promptHint) lines.push(`Style instruction: ${step.promptHint}`);
  if (prevSubject)
    lines.push(`Previous email subject was: "${prevSubject}" — reference it naturally.`);

  lines.push(
    `\nReturn ONLY JSON:\n{ "subject": "...", "html": "<p>opening paragraph</p><p>middle paragraph</p><p>CTA paragraph</p>" }\n\nThe html field must end at the CTA. No sign-off, no name, no contact details, no P.S. — those are appended programmatically after your output.`,
  );

  return lines.join("\n");
}

// ── Response parser (shared) ────────────────────────────────────────────────
function parseDraftResponse(text) {
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

// ── Bedrock drafter (primary) ───────────────────────────────────────────────
async function bedrockDraft(contact, campaign, step, prevSubject, research) {
  if (!bedrockClient) return null;
  const userText = buildPromptText(contact, campaign, step, prevSubject, research);
  const cmd = new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    contentType: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2048,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const resp = await bedrockClient.send(cmd);
  const body = JSON.parse(new TextDecoder().decode(resp.body));
  const text = body?.content?.[0]?.text;
  return parseDraftResponse(text);
}

// ── Gemini drafter (fallback) ───────────────────────────────────────────────
async function geminiDraft(contact, campaign, step, prevSubject, research) {
  const userText = buildPromptText(contact, campaign, step, prevSubject, research);
  // Gemini doesn't have a separate system slot in v1beta generateContent —
  // prepend the system prompt to the user text. Bedrock's Anthropic format
  // does have one, so we use it there.
  const text = `${SYSTEM_PROMPT}\n\n${userText}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseDraftResponse(out);
}

// ── Drafter with provider fallback ──────────────────────────────────────────
async function draftWithFallback(contact, campaign, step, prevSubject, research) {
  if (bedrockClient) {
    try {
      const r = await bedrockDraft(contact, campaign, step, prevSubject, research);
      if (r) return { ...r, provider: "bedrock" };
      console.warn(`  ⚠ Bedrock returned no parseable draft — falling back to Gemini`);
    } catch (err) {
      console.warn(`  ⚠ Bedrock invoke failed (${err.message}) — falling back to Gemini`);
    }
  }
  const r = await geminiDraft(contact, campaign, step, prevSubject, research);
  return r ? { ...r, provider: "gemini" } : null;
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
  const NAME_LIKE = /^<p[^>]*>\s*(Jay Lin|Jay,|jay\.lin|Leo from Sienovo|Leo,|leo@|leo\.liu|intl\.sienovo)/i;
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

console.log(
  `Drafter providers: ` +
    `${bedrockClient ? `bedrock(${BEDROCK_MODEL.split(":")[0].split(".").pop()})` : "bedrock=off"} ` +
    `→ gemini fallback. ` +
    `Research: ${firecrawl ? "firecrawl on" : "firecrawl off"}.`,
);

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
      const research = await researchContact(contact);
      if (research) {
        console.log(`    + research: ${research.split("\n").length} insight(s) from Firecrawl`);
      }
      const draft = await draftWithFallback(contact, campaign, step1, null, research);
      if (!draft) {
        totals.failed++;
        continue;
      }
      console.log(`    via ${draft.provider}`);

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
      // Skip Firecrawl for follow-ups — the prior email already grounded
      // the conversation, the cost saving compounds, and follow-ups should
      // primarily reference the previous email's subject.
      const draft = await draftWithFallback(row, campaign, step, row.prev_subject, null);
      if (!draft) {
        totals.failed++;
        continue;
      }
      console.log(`    via ${draft.provider}`);

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
