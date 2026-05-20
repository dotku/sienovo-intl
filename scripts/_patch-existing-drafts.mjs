import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const SIGNATURE_HTML = `<p>Best,</p>
<p>Leo from Sienovo</p>
<p style="font-size:12px;color:#666;line-height:1.5"><a href="https://intl.sienovo.cn" style="color:#666">intl.sienovo.cn</a> &middot; <a href="mailto:collin.liu@sienovo.cn" style="color:#666">collin.liu@sienovo.cn</a></p>
<p style="font-size:11px;color:#999;line-height:1.4">P.S. Not the right contact? Reply with "remove" and I won't email again.</p>`;

function normalize(html) {
  let body = html.trim();
  const SIG =
    /<p[^>]*>\s*(Best|Thanks|Thank you|Regards|Cheers|Sincerely|Kind regards|Warm regards|Yours)[\s,.]/i;
  const NAME = /<p[^>]*>\s*(Leo|Sienovo|leo@|leo\.liu|intl\.sienovo)/i;
  const PS = /<p[^>]*>\s*P\.?\s*S\.?[\s.:]/i;
  for (let i = 0; i < 6; i++) {
    const m = body.match(/(<p[^>]*>[\s\S]*?<\/p>)\s*$/);
    if (!m) break;
    const last = m[1];
    if (SIG.test(last) || NAME.test(last) || PS.test(last)) {
      body = body.slice(0, -last.length).trim();
      continue;
    }
    break;
  }
  return body + "\n" + SIGNATURE_HTML;
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(`
  SELECT oe.id, oe."htmlContent"
  FROM "OutreachEmail" oe
  WHERE oe."campaignId" = (SELECT id FROM "OutreachCampaign" WHERE name = 'Smart Gas Station — US/CA')
    AND oe.status = 'pending'
`);
console.log("Patching", r.rows.length, "pending drafts...");
for (const row of r.rows) {
  const fixed = normalize(row.htmlContent);
  await c.query(
    `UPDATE "OutreachEmail" SET "htmlContent" = $1, "updatedAt" = NOW() WHERE id = $2`,
    [fixed, row.id],
  );
  console.log("  patched", row.id);
}
await c.end();
