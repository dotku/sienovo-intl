#!/usr/bin/env node
/**
 * Send queued OutreachEmail rows (status=pending) via Brevo. Runs the
 * full guardrails pipeline inline so it works headlessly from cron —
 * doesn't require the Next.js admin API or an auth session.
 *
 *   --daily-cap <N>   override the per-day cap (default 30 warmup)
 *   --dry-run         skip Brevo call, just print what WOULD send
 *
 * Env required: DATABASE_URL, BREVO_API_KEY
 *
 * The /api/admin/outreach/send Next route is functionally equivalent; this
 * script duplicates the logic in pure SQL so cron jobs don't depend on the
 * web app being up.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";

const args = process.argv.slice(2);
const capArg = args.indexOf("--daily-cap");
const DAILY_CAP =
  capArg !== -1 ? parseInt(args[capArg + 1], 10) : 30;
const DRY_RUN = args.includes("--dry-run");

if (!process.env.BREVO_API_KEY) {
  console.error("BREVO_API_KEY missing in env");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing in env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// --- Circuit breaker ----------------------------------------------------
// Match the thresholds in src/lib/outreach-guardrails.ts so the two code
// paths stay aligned.
const CIRCUIT_BOUNCE_RATE = 0.05;
const CIRCUIT_COMPLAINT_RATE = 0.001;
const CIRCUIT_MIN_VOLUME = 30;

const window24h = await client.query(
  `SELECT status, COUNT(*)::int AS n
   FROM "OutreachEmail"
   WHERE "sentAt" >= NOW() - INTERVAL '24 hours'
   GROUP BY status`,
);
const counts = {};
for (const r of window24h.rows) counts[r.status] = r.n;
const sentCount = counts.sent || 0;
const bouncedCount = (counts.bounced || 0) + (counts.hard_bounced || 0);
const complaintCount = (counts.complaint || 0) + (counts.spam || 0);
const total24h = sentCount + bouncedCount + complaintCount;

if (total24h >= CIRCUIT_MIN_VOLUME) {
  const bounceRate = bouncedCount / total24h;
  const complaintRate = complaintCount / total24h;
  if (bounceRate > CIRCUIT_BOUNCE_RATE) {
    console.error(
      `CIRCUIT BREAKER: bounce rate ${(bounceRate * 100).toFixed(2)}% > ${CIRCUIT_BOUNCE_RATE * 100}%`,
    );
    await client.end();
    process.exit(2);
  }
  if (complaintRate > CIRCUIT_COMPLAINT_RATE) {
    console.error(
      `CIRCUIT BREAKER: complaint rate ${(complaintRate * 100).toFixed(2)}% > ${CIRCUIT_COMPLAINT_RATE * 100}%`,
    );
    await client.end();
    process.exit(2);
  }
}

// --- Cap + per-domain throttle ------------------------------------------
const startOfTodayUtc = new Date();
startOfTodayUtc.setUTCHours(0, 0, 0, 0);

const sentTodayRes = await client.query(
  `SELECT c.email
   FROM "OutreachEmail" oe
   JOIN "Contact" c ON c.id = oe."contactId"
   WHERE oe.status = 'sent'
     AND oe."sentAt" >= $1`,
  [startOfTodayUtc],
);
const sentTodayCount = sentTodayRes.rows.length;
const domainsAlreadyContacted = new Set(
  sentTodayRes.rows.map((r) => r.email.split("@")[1]?.toLowerCase()),
);
let budget = Math.max(0, DAILY_CAP - sentTodayCount);

console.log(
  `Sent today: ${sentTodayCount} / ${DAILY_CAP} → budget ${budget}; bounce ${bouncedCount}, complaint ${complaintCount}, sent24h ${sentCount}`,
);
if (budget === 0 && !DRY_RUN) {
  console.log("Cap reached. Nothing to do.");
  await client.end();
  process.exit(0);
}

// --- Candidates ---------------------------------------------------------
const candidatesRes = await client.query(
  `SELECT
     oe.id, oe.subject, oe."htmlContent", oe."campaignId",
     c.email AS contact_email, c."firstName" AS contact_first, c."lastName" AS contact_last,
     cam."senderName", cam."senderEmail", cam."replyTo"
   FROM "OutreachEmail" oe
   JOIN "Contact" c ON c.id = oe."contactId"
   JOIN "OutreachCampaign" cam ON cam.id = oe."campaignId"
   WHERE oe.status = 'pending'
   ORDER BY oe."createdAt" ASC
   LIMIT 500`,
);

let sent = 0;
let failed = 0;
const skipped = [];

function lint(c) {
  if (!c.subject || c.subject.trim().length < 3) return "subject too short";
  if (c.subject.length > 120) return "subject too long";
  if (/\{[a-z_]+\}|\{\{|\}\}/i.test(c.subject))
    return "unresolved merge field in subject";
  if (/\{[a-z_]+\}|\{\{|\}\}/i.test(c.htmlContent))
    return "unresolved merge field in body";
  const bodyText = c.htmlContent.replace(/<[^>]+>/g, "").trim();
  if (bodyText.length < 50) return "body too short";
  if (bodyText.length > 2500) return "body too long";
  if (
    !/(unsubscribe|opt[\s-]?out|remove me|stop receiving|reply with "remove")/i.test(
      c.htmlContent,
    )
  )
    return "missing unsubscribe language";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact_email))
    return "invalid recipient email";
  return null;
}

for (const row of candidatesRes.rows) {
  if (budget <= 0) {
    skipped.push({ email: row.contact_email, reason: "daily cap reached" });
    continue;
  }

  const reason = lint(row);
  if (reason) {
    skipped.push({ email: row.contact_email, reason });
    continue;
  }

  const domain = row.contact_email.split("@")[1]?.toLowerCase();
  if (domain && domainsAlreadyContacted.has(domain)) {
    skipped.push({
      email: row.contact_email,
      reason: `domain ${domain} already contacted today`,
    });
    continue;
  }

  if (DRY_RUN) {
    console.log(`  DRY: would send to ${row.contact_email} (${row.subject})`);
    sent++;
    budget--;
    domainsAlreadyContacted.add(domain);
    continue;
  }

  const recipientName = [row.contact_first, row.contact_last]
    .filter(Boolean)
    .join(" ");

  // Global CC — gives stakeholders visibility into every outbound touch.
  // Set OUTREACH_DEFAULT_CC=jay.lin@sienovo.cn (env / GH secret) and every
  // send copies that address. Comma-separated for multiple. Leave unset
  // and no cc is added — but the field must be OMITTED, not sent as [].
  // Brevo rejects empty cc arrays with `missing_parameter: cc is missing`,
  // which was silently failing every send (0 delivered) before this fix.
  const ccList = (process.env.OUTREACH_DEFAULT_CC || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  const brevoPayload = {
    sender: {
      name: row.senderName,
      email: row.senderEmail,
    },
    replyTo: row.replyTo ? { email: row.replyTo } : undefined,
    to: [
      {
        email: row.contact_email,
        name: recipientName || undefined,
      },
    ],
    subject: row.subject,
    htmlContent: row.htmlContent,
    tags: ["outreach", `campaign:${row.campaignId}`],
    headers: {
      "X-Sienovo-Email-Id": row.id,
      "X-Sienovo-Campaign-Id": row.campaignId,
    },
  };
  if (ccList.length > 0) brevoPayload.cc = ccList;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    if (res.ok) {
      // Brevo returns { messageId: "<...@smtp-relay.mailin.fr>" } — store it
      // so the IMAP reply poller (scripts/outreach-imap-poll.mjs) can match
      // inbound In-Reply-To headers back to this row and stamp repliedAt.
      let brevoMessageId = null;
      try {
        const resp = await res.json();
        brevoMessageId = resp.messageId || null;
      } catch {
        // body wasn't JSON — ignore, just skip the ID
      }
      await client.query(
        `UPDATE "OutreachEmail"
         SET status = 'sent', "sentAt" = NOW(), "updatedAt" = NOW(),
             "brevoMessageId" = COALESCE($2, "brevoMessageId")
         WHERE id = $1`,
        [row.id, brevoMessageId ? brevoMessageId.replace(/^<|>$/g, "") : null],
      );
      console.log(`  ✓ ${row.contact_email}  (${row.subject})`);
      sent++;
      budget--;
      domainsAlreadyContacted.add(domain);
    } else {
      const errText = await res.text();
      await client.query(
        `UPDATE "OutreachEmail"
         SET status = 'failed', error = $1, "updatedAt" = NOW()
         WHERE id = $2`,
        [errText.slice(0, 500), row.id],
      );
      console.error(
        `  ✗ ${row.contact_email}: HTTP ${res.status} ${errText.slice(0, 100)}`,
      );
      failed++;
    }
  } catch (e) {
    await client.query(
      `UPDATE "OutreachEmail"
       SET status = 'failed', error = $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [String(e?.message || e).slice(0, 500), row.id],
    );
    console.error(`  ✗ ${row.contact_email}: ${e?.message}`);
    failed++;
  }

  // Inter-send pacing — keeps us human-looking and well under any rate cap.
  await new Promise((r) => setTimeout(r, 200));
}

console.log(`\n--- Summary ---`);
console.log(`Sent:    ${sent}${DRY_RUN ? " (DRY RUN)" : ""}`);
console.log(`Failed:  ${failed}`);
console.log(`Skipped: ${skipped.length}`);
if (skipped.length) {
  for (const s of skipped.slice(0, 10)) {
    console.log(`  - ${s.email}: ${s.reason}`);
  }
  if (skipped.length > 10) console.log(`  …and ${skipped.length - 10} more`);
}

await client.end();
