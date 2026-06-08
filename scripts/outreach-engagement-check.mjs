/**
 * Daily outreach engagement digest. Queries OutreachEmail for recently-sent
 * emails and reports delivery / open / click / reply / bounce stats, plus the
 * list of prospects who replied — then emails the digest via Resend.
 *
 * Runs in GitHub Actions (which has DATABASE_URL + RESEND_API_KEY as secrets);
 * a remote cloud agent can't reach the prod DB, so this lives in CI.
 *
 * Env: DATABASE_URL (required), RESEND_API_KEY (required to email),
 *      OUTREACH_REPORT_TO (recipient, default jay.lin@sienovo.cn),
 *      WINDOW_DAYS (lookback, default 7).
 */

import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const RECIPIENT = process.env.OUTREACH_REPORT_TO || "jay.lin@sienovo.cn";
const WINDOW_DAYS = parseInt(process.env.WINDOW_DAYS || "7", 10);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const esc = (s) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

try {
  // Engagement over the lookback window (emails actually sent).
  const { rows: agg } = await client.query(
    `SELECT
       COUNT(*)::int                                         AS sent,
       COUNT("deliveredAt")::int                             AS delivered,
       COUNT("openedAt")::int                                AS opened,
       COUNT("clickedAt")::int                               AS clicked,
       COUNT("repliedAt")::int                               AS replied,
       COUNT("bouncedAt")::int                               AS bounced,
       COUNT(*) FILTER (WHERE "sentAt" > now() - interval '24 hours')::int AS sent_24h
     FROM "OutreachEmail"
     WHERE status = 'sent' AND "sentAt" > now() - ($1 || ' days')::interval`,
    [String(WINDOW_DAYS)],
  );
  const s = agg[0];

  // Who replied — the signal worth acting on.
  const { rows: replies } = await client.query(
    `SELECT c.email, c.company, oe.subject, oe."repliedAt"
       FROM "OutreachEmail" oe JOIN "Contact" c ON c.id = oe."contactId"
      WHERE oe."repliedAt" IS NOT NULL AND oe."repliedAt" > now() - ($1 || ' days')::interval
      ORDER BY oe."repliedAt" DESC`,
    [String(WINDOW_DAYS)],
  );

  const pct = (n) => (s.sent ? Math.round((n / s.sent) * 100) : 0);
  const summary =
    `近 ${WINDOW_DAYS} 天发送 ${s.sent}（24h 内 ${s.sent_24h}）· 投递 ${s.delivered} · ` +
    `打开 ${s.opened}（${pct(s.opened)}%）· 点击 ${s.clicked} · 回复 ${s.replied} · 退信 ${s.bounced}`;
  console.log(summary);

  const replyRows = replies.length
    ? replies
        .map(
          (r) =>
            `<tr><td style="border-bottom:1px solid #eee;padding:6px">${esc(r.email)}</td>` +
            `<td style="border-bottom:1px solid #eee;padding:6px">${esc(r.company || "—")}</td>` +
            `<td style="border-bottom:1px solid #eee;padding:6px;font-size:12px">${esc(r.subject || "")}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="padding:6px;color:#999">暂无回复</td></tr>`;

  const html = `
  <div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:640px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 4px">Outreach 战报</h2>
    <p style="color:#666;margin:0 0 16px">近 ${WINDOW_DAYS} 天 · 发件 jay.lin@sienovo.cn</p>
    <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
      <tr><td style="border-bottom:1px solid #eee">已发送（24h 内）</td><td style="border-bottom:1px solid #eee;text-align:right"><b>${s.sent}</b> (${s.sent_24h})</td></tr>
      <tr><td style="border-bottom:1px solid #eee">投递</td><td style="border-bottom:1px solid #eee;text-align:right"><b>${s.delivered}</b></td></tr>
      <tr><td style="border-bottom:1px solid #eee">打开</td><td style="border-bottom:1px solid #eee;text-align:right"><b>${s.opened}</b> (${pct(s.opened)}%)</td></tr>
      <tr><td style="border-bottom:1px solid #eee">点击</td><td style="border-bottom:1px solid #eee;text-align:right"><b>${s.clicked}</b></td></tr>
      <tr><td style="border-bottom:1px solid #eee">回复</td><td style="border-bottom:1px solid #eee;text-align:right"><b style="color:#1a7f37">${s.replied}</b></td></tr>
      <tr><td>退信</td><td style="text-align:right"><b${s.bounced ? ' style="color:#a04040"' : ""}>${s.bounced}</b></td></tr>
    </table>
    <h3 style="margin:20px 0 8px;font-size:15px">回复的客户</h3>
    <table cellpadding="0" style="border-collapse:collapse;width:100%;font-size:13px">
      <tr style="color:#666"><td style="padding:6px">邮箱</td><td style="padding:6px">公司</td><td style="padding:6px">主题</td></tr>
      ${replyRows}
    </table>
    <p style="color:#999;font-size:12px;margin-top:16px">数据来自 OutreachEmail（Brevo webhook 投递/打开 + IMAP 回复检测）。</p>
  </div>`;

  if (process.env.RESEND_API_KEY) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sienovo Outreach <noreply@sienovo.cn>",
        to: [RECIPIENT],
        subject: `[Outreach] 战报 · 发 ${s.sent_24h}/24h · 回复 ${s.replied} · 打开率 ${pct(s.opened)}%`,
        html,
      }),
    });
    console.log(resp.ok ? `✓ emailed ${RECIPIENT}` : `✗ email failed ${resp.status}: ${await resp.text()}`);
  } else {
    console.log("RESEND_API_KEY not set — digest printed only");
  }
} finally {
  await client.end();
}
