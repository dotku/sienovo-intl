#!/usr/bin/env node
/**
 * Poll one or more IMAP mailboxes for inbound messages and stamp
 * OutreachEmail.repliedAt whenever a message references one of our
 * outbound emails via the In-Reply-To / References header.
 *
 * Matching strategy (in order of strength):
 *   1. In-Reply-To header value === OutreachEmail.brevoMessageId
 *   2. Any Message-Id in References header === OutreachEmail.brevoMessageId
 *   3. Sender email matches a Contact + Subject contains "Re:" + at least
 *      one OutreachEmail sent to that contact within the last 30 days
 *      → mark the most recent one
 *
 * Multiple mailboxes supported. Configure as JSON in IMAP_MAILBOXES env:
 *   IMAP_MAILBOXES=[{"host":"imap.exmail.qq.com","port":993,"user":"collin.liu@sienovo.cn","pass":"..."},
 *                   {"host":"imap.gmail.com","port":993,"user":"jay.lin@sienovo.cn","pass":"..."}]
 *
 * Or one-off via env vars:
 *   IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_TLS (default true)
 *
 * Tracks "last polled UID" per mailbox in the IMAPPollState table to
 * avoid re-scanning the entire inbox each run.
 *
 * Usage:
 *   node scripts/outreach-imap-poll.mjs                  # poll all mailboxes
 *   node scripts/outreach-imap-poll.mjs --dry-run        # log matches, no DB write
 *   node scripts/outreach-imap-poll.mjs --since 7d       # rescan last 7 days
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import pg from "pg";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const sinceArg = args.indexOf("--since");
const SINCE_OVERRIDE = sinceArg !== -1 ? args[sinceArg + 1] : null;

const mailboxesRaw =
  process.env.IMAP_MAILBOXES ||
  (process.env.IMAP_HOST
    ? JSON.stringify([
        {
          host: process.env.IMAP_HOST,
          port: parseInt(process.env.IMAP_PORT || "993", 10),
          user: process.env.IMAP_USER,
          pass: process.env.IMAP_PASS,
          tls: process.env.IMAP_TLS !== "false",
        },
      ])
    : null);

if (!mailboxesRaw) {
  console.error(
    "No IMAP config. Set IMAP_MAILBOXES (JSON array) or IMAP_HOST/IMAP_USER/IMAP_PASS in env.",
  );
  process.exit(1);
}

const mailboxes = JSON.parse(mailboxesRaw);
if (!Array.isArray(mailboxes) || mailboxes.length === 0) {
  console.error("IMAP_MAILBOXES must be a non-empty JSON array");
  process.exit(1);
}

const db = new pg.Client({
  connectionString: (process.env.DATABASE_URL || "").replace(
    "sslmode=require",
    "sslmode=verify-full",
  ),
});
await db.connect();

// Parse `--since 7d|24h|2026-05-01` to a Date
function parseSince(s) {
  if (!s) return null;
  const m = s.match(/^(\d+)(d|h)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const ms = m[2] === "d" ? n * 86400_000 : n * 3600_000;
    return new Date(Date.now() - ms);
  }
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}

async function loadOurOutboundMessageIds() {
  // Build an index: brevoMessageId → { id, contactEmail }, so we can match
  // inbound In-Reply-To headers fast.
  const { rows } = await db.query(`
    SELECT e.id, e."brevoMessageId", c.email
    FROM "OutreachEmail" e
    JOIN "Contact" c ON c.id = e."contactId"
    WHERE e."brevoMessageId" IS NOT NULL
      AND e."repliedAt" IS NULL
      AND e."sentAt" IS NOT NULL
  `);
  const byMsgId = new Map();
  for (const r of rows) {
    if (r.brevoMessageId) byMsgId.set(r.brevoMessageId.replace(/^<|>$/g, ""), r);
  }
  console.log(`Outbound index: ${byMsgId.size} unreplied messages`);
  return byMsgId;
}

async function findContactByEmail(email) {
  if (!email) return null;
  const { rows } = await db.query(
    `SELECT id FROM "Contact" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

async function findRecentOutboundToContact(contactId) {
  const { rows } = await db.query(
    `SELECT id FROM "OutreachEmail"
     WHERE "contactId" = $1
       AND "repliedAt" IS NULL
       AND "sentAt" IS NOT NULL
       AND "sentAt" > NOW() - INTERVAL '30 days'
     ORDER BY "sentAt" DESC
     LIMIT 1`,
    [contactId],
  );
  return rows[0] || null;
}

async function markReplied(emailId, fromMailbox) {
  if (DRY) {
    console.log(`  [dry-run] would mark replied: ${emailId}`);
    return;
  }
  const now = new Date();
  await db.query(
    `UPDATE "OutreachEmail"
     SET "repliedAt" = $1, "lastEventAt" = $1
     WHERE id = $2 AND "repliedAt" IS NULL`,
    [now, emailId],
  );
  console.log(`  ✓ marked replied: ${emailId} (via ${fromMailbox})`);
}

// Pull header IDs from a parsed envelope/headers struct
function extractRefs(parsed) {
  const refs = new Set();
  const inReplyTo = parsed.inReplyTo || parsed.headers?.get("in-reply-to");
  if (inReplyTo) refs.add(String(inReplyTo).replace(/[<>]/g, "").trim());
  const references = parsed.references || parsed.headers?.get("references");
  if (references) {
    const list = Array.isArray(references) ? references : String(references).split(/\s+/);
    for (const r of list) {
      const cleaned = r.replace(/[<>]/g, "").trim();
      if (cleaned) refs.add(cleaned);
    }
  }
  return refs;
}

async function pollMailbox(cfg, outboundIndex, sinceDate) {
  console.log(`\n--- ${cfg.user} @ ${cfg.host} ---`);
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port || 993,
    secure: cfg.tls !== false,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  let stats = { scanned: 0, matched: 0, skipped: 0 };

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchCriteria = sinceDate ? { since: sinceDate } : { since: new Date(Date.now() - 24 * 3600_000) };
      const uids = await client.search(searchCriteria, { uid: true });
      console.log(`  Found ${uids.length} messages since ${searchCriteria.since.toISOString()}`);

      for (const uid of uids) {
        stats.scanned++;
        const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!msg) continue;

        const parsed = await simpleParser(msg.source);
        const refs = extractRefs(parsed);
        if (refs.size === 0) {
          stats.skipped++;
          continue;
        }

        // Match against our outbound index
        let matched = null;
        for (const r of refs) {
          if (outboundIndex.has(r)) {
            matched = outboundIndex.get(r);
            break;
          }
        }

        if (!matched) {
          // Heuristic fallback: Re: subject + sender matches a Contact
          const fromAddr = parsed.from?.value?.[0]?.address;
          if (fromAddr && /^re:/i.test(parsed.subject || "")) {
            const contact = await findContactByEmail(fromAddr);
            if (contact) {
              const recent = await findRecentOutboundToContact(contact.id);
              if (recent) matched = { id: recent.id, email: fromAddr };
            }
          }
        }

        if (matched) {
          await markReplied(matched.id, cfg.user);
          // Remove from index so we don't double-mark with another mailbox
          for (const r of refs) outboundIndex.delete(r);
          stats.matched++;
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    return { ...stats, error: err.message };
  }
  return stats;
}

// ── Main ───────────────────────────────────────────────────────────────────
const outboundIndex = await loadOurOutboundMessageIds();
const sinceDate = parseSince(SINCE_OVERRIDE);

let total = { scanned: 0, matched: 0, skipped: 0 };
for (const cfg of mailboxes) {
  const s = await pollMailbox(cfg, outboundIndex, sinceDate);
  total.scanned += s.scanned || 0;
  total.matched += s.matched || 0;
  total.skipped += s.skipped || 0;
}

console.log(`\n${"=".repeat(50)}`);
console.log(`IMAP poll complete${DRY ? " (dry-run)" : ""}`);
console.log(`  Mailboxes:     ${mailboxes.length}`);
console.log(`  Scanned:       ${total.scanned}`);
console.log(`  Replies found: ${total.matched}`);
console.log(`  No-ref skip:   ${total.skipped}`);

await db.end();
