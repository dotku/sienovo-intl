import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Brevo webhook receiver. Brevo POSTs one event at a time for each
 * delivery, open, click, bounce, complaint, etc. We:
 *   1. Match the event back to an OutreachEmail row using the custom
 *      X-Sienovo-Email-Id header we attached at send time.
 *   2. Update that row's status so it shows up in the dashboard and
 *      feeds the circuit breaker in outreach-guardrails.ts.
 *   3. On unsubscribe / spam complaint, flip the Contact's `isLead`
 *      to false so we never email them again.
 *
 * Configure in Brevo: Settings → Transactional → Webhooks → add URL
 *   https://intl.sienovo.cn/api/webhooks/brevo
 * and enable events: sent, hard_bounce, soft_bounce, spam, unsubscribe,
 * opened, click.
 *
 * Brevo's webhook is not authenticated by default — protect by:
 *   - Setting BREVO_WEBHOOK_SECRET in env
 *   - Configuring it in Brevo's webhook URL as ?secret=...
 *   - Or relying on Cloudflare to filter by IP allowlist
 */

// Map Brevo event names → OutreachEmail status values. "opened" / "click"
// don't change status (they're additive lifecycle events stamped onto
// the new timestamp columns below).
const BREVO_STATUS_MAP: Record<string, string> = {
  hard_bounce: "hard_bounced",
  hardbounce: "hard_bounced",
  soft_bounce: "bounced",
  softbounce: "bounced",
  spam: "complaint",
  complaint: "complaint",
  blocked: "bounced",
  invalid_email: "hard_bounced",
  unsubscribed: "unsubscribed",
  delivered: "delivered",
};

// Brevo event → which timestamp column on OutreachEmail to stamp. Multiple
// events of the same type only stamp the FIRST occurrence — later opens
// shouldn't reset openedAt.
const BREVO_TIMESTAMP_COL: Record<string, string> = {
  delivered: "deliveredAt",
  opened: "openedAt",
  unique_opened: "openedAt",
  uniqueopened: "openedAt",
  click: "clickedAt",
  hard_bounce: "bouncedAt",
  hardbounce: "bouncedAt",
  soft_bounce: "bouncedAt",
  softbounce: "bouncedAt",
  blocked: "bouncedAt",
  invalid_email: "bouncedAt",
  spam: "complaintAt",
  complaint: "complaintAt",
  unsubscribed: "unsubscribedAt",
};

const BOUNCE_TYPE: Record<string, string> = {
  hard_bounce: "hard",
  hardbounce: "hard",
  soft_bounce: "soft",
  softbounce: "soft",
  blocked: "blocked",
  invalid_email: "invalid",
};

type BrevoEvent = {
  event?: string;
  email?: string;
  date?: string;
  ts?: number;
  // Custom headers we set at send time:
  "X-Mailin-Custom"?: string; // Brevo may store custom headers here
  // Our custom headers — Brevo forwards them as the value or as keys on
  // the event object depending on the integration version.
  "X-Sienovo-Email-Id"?: string;
  "X-Sienovo-Campaign-Id"?: string;
  tags?: string[];
  reason?: string;
};

function extractEmailId(event: BrevoEvent): string | null {
  if (event["X-Sienovo-Email-Id"]) return event["X-Sienovo-Email-Id"];
  // Some Brevo integrations bundle custom headers as a JSON string.
  const custom = event["X-Mailin-Custom"];
  if (custom) {
    try {
      const parsed = JSON.parse(custom);
      if (parsed?.["X-Sienovo-Email-Id"]) return parsed["X-Sienovo-Email-Id"];
    } catch {
      // not JSON — ignore
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let event: BrevoEvent;
  try {
    event = (await req.json()) as BrevoEvent;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const eventName = event.event?.toLowerCase() || "";
  const newStatus = BREVO_STATUS_MAP[eventName];
  const tsCol = BREVO_TIMESTAMP_COL[eventName];
  const emailId = extractEmailId(event);

  // Always log non-noisy events. Opens/clicks logged at debug-level only.
  if (eventName !== "opened" && eventName !== "click") {
    console.log(
      `[brevo-webhook] event=${eventName} email=${event.email} id=${emailId}`,
    );
  }

  // Anything we don't recognise gets ack'd but otherwise ignored
  if (!newStatus && !tsCol) {
    return NextResponse.json({ ok: true, action: "ignored" });
  }

  const eventTs = event.date
    ? new Date(event.date)
    : event.ts
      ? new Date(event.ts * 1000)
      : new Date();

  // Build the update payload. Stamp lastEventAt every time, the per-event
  // column only on first occurrence, status only when the event maps to a
  // terminal status.
  function buildUpdate(existing: {
    deliveredAt?: Date | null;
    openedAt?: Date | null;
    clickedAt?: Date | null;
    bouncedAt?: Date | null;
    complaintAt?: Date | null;
    unsubscribedAt?: Date | null;
  }): Record<string, unknown> {
    const data: Record<string, unknown> = {
      lastEventAt: eventTs,
      updatedAt: new Date(),
    };
    if (tsCol) {
      const existingTs = (existing as Record<string, Date | null | undefined>)[tsCol];
      if (!existingTs) data[tsCol] = eventTs;
    }
    if (newStatus) {
      data.status = newStatus;
      if (event.reason) data.error = event.reason.slice(0, 500);
    }
    if (BOUNCE_TYPE[eventName]) data.bounceType = BOUNCE_TYPE[eventName];
    return data;
  }

  // Update OutreachEmail row if we can match it.
  let updatedRow = false;
  if (emailId) {
    const row = await prisma.outreachEmail.findUnique({ where: { id: emailId } });
    if (row) {
      await prisma.outreachEmail.update({ where: { id: row.id }, data: buildUpdate(row) });
      updatedRow = true;
    }
  } else if (event.email) {
    const recent = await prisma.outreachEmail.findFirst({
      where: { contact: { email: event.email.toLowerCase() } },
      orderBy: { sentAt: "desc" },
    });
    if (recent) {
      await prisma.outreachEmail.update({ where: { id: recent.id }, data: buildUpdate(recent) });
      updatedRow = true;
    }
  }

  // Suppress the Contact going forward when they unsubscribe or complain.
  if (
    (newStatus === "unsubscribed" || newStatus === "complaint") &&
    event.email
  ) {
    await prisma.contact
      .updateMany({
        where: { email: event.email.toLowerCase() },
        data: { isLead: false },
      })
      .catch((err) => {
        console.error("[brevo-webhook] failed to suppress contact", err);
      });
  }

  return NextResponse.json({
    ok: true,
    action: newStatus || (tsCol ? "stamped" : "ignored"),
    matched: updatedRow,
  });
}

// Brevo periodically pings the URL with GET to verify it's alive.
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
