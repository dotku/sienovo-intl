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
 *   https://sienovo.jytech.us/api/webhooks/brevo
 * and enable events: sent, hard_bounce, soft_bounce, spam, unsubscribe,
 * opened, click.
 *
 * Brevo's webhook is not authenticated by default — protect by:
 *   - Setting BREVO_WEBHOOK_SECRET in env
 *   - Configuring it in Brevo's webhook URL as ?secret=...
 *   - Or relying on Cloudflare to filter by IP allowlist
 */

// Map Brevo event names → OutreachEmail status values. Anything not in
// this map is logged but ignored (e.g. "opened", "click" — useful for
// analytics but we don't currently store them per-row).
const BREVO_STATUS_MAP: Record<string, string> = {
  hard_bounce: "hard_bounced",
  soft_bounce: "bounced",
  spam: "complaint",
  blocked: "bounced",
  invalid_email: "hard_bounced",
  unsubscribed: "unsubscribed",
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
  const emailId = extractEmailId(event);

  // Always log to api_usage for visibility on the admin page.
  // (Skipping for "opened"/"click" — too noisy.)
  if (eventName !== "opened" && eventName !== "click") {
    console.log(
      `[brevo-webhook] event=${eventName} email=${event.email} id=${emailId}`,
    );
  }

  if (!newStatus) {
    // Not a status-changing event; ack and move on.
    return NextResponse.json({ ok: true, action: "ignored" });
  }

  // Update OutreachEmail row if we can match it.
  if (emailId) {
    await prisma.outreachEmail
      .update({
        where: { id: emailId },
        data: {
          status: newStatus,
          error: event.reason ? event.reason.slice(0, 500) : undefined,
          updatedAt: new Date(),
        },
      })
      .catch((err) => {
        console.error("[brevo-webhook] failed to update email row", err);
      });
  } else if (event.email) {
    // Fallback: best-effort match by recipient + most recent sent row.
    const recent = await prisma.outreachEmail.findFirst({
      where: { contact: { email: event.email.toLowerCase() } },
      orderBy: { sentAt: "desc" },
    });
    if (recent) {
      await prisma.outreachEmail.update({
        where: { id: recent.id },
        data: { status: newStatus, updatedAt: new Date() },
      });
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

  return NextResponse.json({ ok: true, action: newStatus });
}
