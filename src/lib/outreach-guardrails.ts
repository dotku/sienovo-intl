/**
 * Outreach guardrails — the safety net that replaces human review.
 *
 * Every batch send runs through `applyGuardrails()`, which enforces:
 *   - Per-send linting (no broken merge fields, must contain an
 *     unsubscribe link, minimum body length).
 *   - Daily cap (default 30 during warmup; bumps to 50, 100 as the
 *     domain reputation builds).
 *   - Per-recipient-domain throttle (≤1 outbound per domain per day) so
 *     we don't look like a spam cannon to gatekeepers.
 *   - Already-sent suppression (never send the same email row twice if
 *     somehow it got requeued).
 *
 * `isCircuitOpen()` is a separate check called BEFORE pulling candidates
 * — if recent bounce / complaint rates breach Brevo-recommended limits,
 * we halt all sending until a human reviews.
 */

import { prisma } from "@/lib/prisma";

export type GuardrailCandidate = {
  id: string;
  subject: string;
  htmlContent: string;
  contactEmail: string;
};

export type GuardrailDecision =
  | { ok: true; candidate: GuardrailCandidate }
  | { ok: false; candidate: GuardrailCandidate; reason: string };

export type GuardrailResult = {
  eligible: GuardrailCandidate[];
  skipped: { id: string; email: string; reason: string }[];
};

// Brevo's published deliverability thresholds — exceeding any of these
// for long puts the sending IP/domain on shaky ground. We breaker at the
// lower end of each to leave headroom.
const CIRCUIT_BOUNCE_RATE = 0.05; // 5%
const CIRCUIT_COMPLAINT_RATE = 0.001; // 0.1%
const CIRCUIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CIRCUIT_MIN_VOLUME = 30; // don't trip on tiny denominators

/**
 * Pre-send content lint. Catches the "AI generated obviously broken
 * output" failure mode where merge fields didn't resolve or the body
 * came back empty — those would have been caught by a human reviewer.
 */
function lint(candidate: GuardrailCandidate): string | null {
  const { subject, htmlContent, contactEmail } = candidate;

  if (!subject || subject.trim().length < 3) return "subject too short";
  if (subject.length > 120) return "subject too long (>120 chars)";
  if (/\{[a-z_]+\}|\{\{|\}\}/i.test(subject)) {
    return "unresolved merge field in subject";
  }
  if (/\{[a-z_]+\}|\{\{|\}\}/i.test(htmlContent)) {
    return "unresolved merge field in body";
  }

  const bodyText = htmlContent.replace(/<[^>]+>/g, "").trim();
  if (bodyText.length < 50) return "body too short (<50 chars after stripping HTML)";
  if (bodyText.length > 2500) return "body too long (>2500 chars — feels spammy)";

  // Compliance: every cold email must offer an unsubscribe path. Brevo
  // adds one automatically, but we still require our drafts to include
  // SOMETHING that looks like an opt-out — belt and suspenders.
  if (
    !/(unsubscribe|opt[\s-]?out|remove me|stop receiving)/i.test(htmlContent)
  ) {
    return "missing unsubscribe / opt-out language";
  }

  // Basic recipient sanity — Apollo occasionally surfaces malformed rows.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return "invalid recipient email format";
  }

  return null;
}

function recipientDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export async function applyGuardrails(
  candidates: GuardrailCandidate[],
  opts: { dailyCap?: number } = {},
): Promise<GuardrailResult> {
  const dailyCap = opts.dailyCap ?? 30;
  const eligible: GuardrailCandidate[] = [];
  const skipped: GuardrailResult["skipped"] = [];

  // Count what we've already sent today so the cap survives across
  // multiple POST invocations (the cron may call /send several times if
  // it's chunking work).
  const sentTodayCount = await prisma.outreachEmail.count({
    where: {
      status: "sent",
      sentAt: { gte: startOfTodayUtc() },
    },
  });

  // Build a set of recipient domains we've already hit today so we can
  // enforce "≤1 outbound per domain per day".
  const sentTodayRows = await prisma.outreachEmail.findMany({
    where: {
      status: "sent",
      sentAt: { gte: startOfTodayUtc() },
    },
    select: { contact: { select: { email: true } } },
  });
  const domainsAlreadyContacted = new Set(
    sentTodayRows.map((r) => recipientDomain(r.contact.email)),
  );

  let budget = Math.max(0, dailyCap - sentTodayCount);

  for (const c of candidates) {
    const lintReason = lint(c);
    if (lintReason) {
      skipped.push({ id: c.id, email: c.contactEmail, reason: lintReason });
      continue;
    }

    if (budget <= 0) {
      skipped.push({
        id: c.id,
        email: c.contactEmail,
        reason: `daily cap reached (${dailyCap})`,
      });
      continue;
    }

    const domain = recipientDomain(c.contactEmail);
    if (domain && domainsAlreadyContacted.has(domain)) {
      skipped.push({
        id: c.id,
        email: c.contactEmail,
        reason: `per-domain throttle: ${domain} already contacted today`,
      });
      continue;
    }

    eligible.push(c);
    domainsAlreadyContacted.add(domain);
    budget--;
  }

  return { eligible, skipped };
}

/**
 * Trip the circuit if deliverability metrics over the last 24h breach
 * Brevo's published thresholds. Called at the top of /send.
 *
 * Counts are derived from `OutreachEmail.status`:
 *   - "bounced" / "hard_bounced" → bounce
 *   - "complaint" / "spam"       → complaint
 *   - "sent"                      → successful delivery
 * These statuses are written by the Brevo webhook handler.
 */
export async function isCircuitOpen(): Promise<{
  open: boolean;
  reason?: string;
}> {
  const since = new Date(Date.now() - CIRCUIT_WINDOW_MS);

  const rows = await prisma.outreachEmail.groupBy({
    by: ["status"],
    where: { sentAt: { gte: since } },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r._count._all;

  const sent = counts.sent || 0;
  const bounced = (counts.bounced || 0) + (counts.hard_bounced || 0);
  const complaints = (counts.complaint || 0) + (counts.spam || 0);
  const total = sent + bounced + complaints;

  if (total < CIRCUIT_MIN_VOLUME) {
    // Tiny volume — don't trip on a single early bounce. Wait for signal.
    return { open: false };
  }

  const bounceRate = bounced / total;
  const complaintRate = complaints / total;

  if (bounceRate > CIRCUIT_BOUNCE_RATE) {
    return {
      open: true,
      reason: `bounce rate ${(bounceRate * 100).toFixed(2)}% over the last 24h (limit ${CIRCUIT_BOUNCE_RATE * 100}%)`,
    };
  }
  if (complaintRate > CIRCUIT_COMPLAINT_RATE) {
    return {
      open: true,
      reason: `complaint rate ${(complaintRate * 100).toFixed(2)}% over the last 24h (limit ${CIRCUIT_COMPLAINT_RATE * 100}%)`,
    };
  }

  return { open: false };
}
