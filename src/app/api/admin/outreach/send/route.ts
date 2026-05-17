import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { trackApiUsage } from "@/lib/api-usage";
import {
  applyGuardrails,
  isCircuitOpen,
  type GuardrailCandidate,
} from "@/lib/outreach-guardrails";

const UNAUTHORIZED = NextResponse.json(
  { error: "Unauthorized" },
  { status: 403 },
);

/**
 * Sends queued outreach emails through Brevo. The "human approval" step
 * has been dropped — emails with `status="pending"` are eligible. The
 * guardrails (per-day cap, per-domain throttle, pre-send lint, bounce /
 * complaint circuit breaker) substitute for the manual review.
 *
 * POST body: { emailIds?: string[]; campaignId?: string; dailyCap?: number }
 *   - If neither id nor campaignId is provided, sends across all campaigns.
 *   - Default daily cap is 30 to protect domain reputation during warmup.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    return NextResponse.json(
      { error: "Brevo API key not configured" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { emailIds, campaignId, dailyCap } = body as {
    emailIds?: string[];
    campaignId?: string;
    dailyCap?: number;
  };

  // Circuit breaker — if the last 24h saw too many bounces / complaints,
  // bail out without touching Brevo.
  const circuit = await isCircuitOpen();
  if (circuit.open) {
    return NextResponse.json(
      {
        error: "Outreach circuit breaker is open",
        reason: circuit.reason,
        sent: 0,
        failed: 0,
        skipped: 0,
      },
      { status: 503 },
    );
  }

  const where: Record<string, unknown> = { status: "pending" };
  if (emailIds?.length) where.id = { in: emailIds };
  else if (campaignId) where.campaignId = campaignId;

  const candidates = await prisma.outreachEmail.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      contact: true,
      campaign: {
        select: { senderName: true, senderEmail: true, replyTo: true },
      },
    },
    take: 500, // upper bound; guardrails further trim
  });

  const guardrailInput: GuardrailCandidate[] = candidates.map((c) => ({
    id: c.id,
    subject: c.subject,
    htmlContent: c.htmlContent,
    contactEmail: c.contact.email,
  }));
  const { eligible, skipped } = await applyGuardrails(guardrailInput, {
    dailyCap: dailyCap ?? 30,
  });

  const eligibleIds = new Set(eligible.map((e) => e.id));
  const toSend = candidates.filter((c) => eligibleIds.has(c.id));

  let sent = 0;
  let failed = 0;

  for (const email of toSend) {
    try {
      const recipientName = [email.contact.firstName, email.contact.lastName]
        .filter(Boolean)
        .join(" ");

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: email.campaign.senderName,
            email: email.campaign.senderEmail,
          },
          // Reply-To routes prospect replies to the real inbox even though
          // the From: address belongs to a different (brand-aligned) domain.
          replyTo: email.campaign.replyTo
            ? { email: email.campaign.replyTo }
            : undefined,
          to: [
            { email: email.contact.email, name: recipientName || undefined },
          ],
          subject: email.subject,
          htmlContent: email.htmlContent,
          // Tags + custom headers surface in Brevo's UI and webhook
          // payloads so we can route bounces/complaints back to the row.
          tags: ["outreach", `campaign:${email.campaignId}`],
          headers: {
            "X-Sienovo-Email-Id": email.id,
            "X-Sienovo-Campaign-Id": email.campaignId,
          },
        }),
      });

      if (res.ok) {
        await prisma.outreachEmail.update({
          where: { id: email.id },
          data: { status: "sent", sentAt: new Date() },
        });
        await trackApiUsage("brevo", "outreach_send", true);
        sent++;
      } else {
        const errText = await res.text();
        await prisma.outreachEmail.update({
          where: { id: email.id },
          data: { status: "failed", error: errText.slice(0, 500) },
        });
        await trackApiUsage("brevo", "outreach_send", false);
        failed++;
      }
    } catch (e) {
      await prisma.outreachEmail.update({
        where: { id: email.id },
        data: {
          status: "failed",
          error: e instanceof Error ? e.message : "Unknown error",
        },
      });
      failed++;
    }

    // Brevo's transactional limits are generous, but 200ms inter-send
    // pacing keeps us well under any per-second cap and looks more human
    // to receiving servers.
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({
    sent,
    failed,
    skipped: skipped.length,
    skipReasons: skipped.slice(0, 20),
    total: candidates.length,
  });
}
