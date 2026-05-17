#!/usr/bin/env node
/**
 * Seed the first live outreach campaign: Smart Gas Station — US/Canada.
 *
 * Uses plain `pg` for consistency with the other outreach scripts (and
 * because the Prisma adapter setup has quirks against the pooled Neon
 * endpoint at the moment). Re-runnable: upserts by campaign name.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";

const CAMPAIGN_NAME = "Smart Gas Station — US/CA";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const campaignData = {
  name: CAMPAIGN_NAME,
  status: "active",
  targetIndustries:
    "Oil & Gas, Petroleum, Convenience Stores, Fuel Retail, Gas Station",
  targetTitles:
    "Operations Director, Director of Operations, VP Operations, Loss Prevention Manager, Director of Loss Prevention, Risk Manager, IT Director, Head of Safety, Director of Risk Management",
  targetCountries: "United States, Canada",
  targetDomains: "",
  senderName: "Leo from Sienovo",
  senderEmail: "leo@sienovo.cn",
  replyTo: "leo.liu@jytech.us",
  productFocus:
    "INT-AIBOX-P-8 for smart gas station safety — real-time smoking detection, phone-use-while-pumping alerts, intrusion/loitering after hours, and fire/smoke detection at fuel islands.",
  aiContext:
    "Sienovo's INT-AIBOX runs on-prem at the station — no cloud roundtrip, alerts fire in <500ms. Most US/CA fuel retailers run video for after-the-fact incident review; we shift it to real-time prevention. Concrete deployments: 600+ stations across China with smoking/phone-use detection; insurance loss-claim reduction is the typical ROI angle. Common objections: 'we already have cameras' — frame edge AI as the analytics layer on top of cameras they have, not a rip-and-replace.",
};

const existing = await client.query(
  `SELECT id FROM "OutreachCampaign" WHERE name = $1 LIMIT 1`,
  [campaignData.name],
);

let campaignId;
if (existing.rows.length > 0) {
  campaignId = existing.rows[0].id;
  await client.query(
    `UPDATE "OutreachCampaign" SET
       status=$2, "targetIndustries"=$3, "targetTitles"=$4,
       "targetCountries"=$5, "targetDomains"=$6, "senderName"=$7,
       "senderEmail"=$8, "replyTo"=$9, "productFocus"=$10, "aiContext"=$11,
       "updatedAt"=NOW()
     WHERE id = $1`,
    [
      campaignId,
      campaignData.status,
      campaignData.targetIndustries,
      campaignData.targetTitles,
      campaignData.targetCountries,
      campaignData.targetDomains,
      campaignData.senderName,
      campaignData.senderEmail,
      campaignData.replyTo,
      campaignData.productFocus,
      campaignData.aiContext,
    ],
  );
  console.log(`Updated campaign: ${campaignData.name} (${campaignId})`);
} else {
  campaignId =
    "cmp" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await client.query(
    `INSERT INTO "OutreachCampaign" (
       id, name, status, "targetIndustries", "targetTitles",
       "targetCountries", "targetDomains", "senderName", "senderEmail",
       "replyTo", "productFocus", "aiContext", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
     )`,
    [
      campaignId,
      campaignData.name,
      campaignData.status,
      campaignData.targetIndustries,
      campaignData.targetTitles,
      campaignData.targetCountries,
      campaignData.targetDomains,
      campaignData.senderName,
      campaignData.senderEmail,
      campaignData.replyTo,
      campaignData.productFocus,
      campaignData.aiContext,
    ],
  );
  console.log(`Created campaign: ${campaignData.name} (${campaignId})`);
}

// Recreate steps cleanly for idempotent re-runs.
await client.query(`DELETE FROM "OutreachStep" WHERE "campaignId" = $1`, [
  campaignId,
]);

const steps = [
  {
    stepOrder: 1,
    delayDays: 0,
    subject: "Smoking/phone detection at {company}'s pumps",
    promptHint:
      "Lead with the specific risk: smoking or phone use at the pump is the single biggest fire-cause for fuel retail. Mention edge AI catches it in real-time vs. their cameras catching it post-incident. End with: 'Worth a 15-min look at how Chevron/Shell-tier operators are deploying this?' Keep it under 100 words.",
  },
  {
    stepOrder: 2,
    delayDays: 3,
    subject: "Re: smoking detection",
    promptHint:
      "Brief follow-up. Reference the first email. Drop one specific data point: 'A 200-station deployment in Asia is reporting a 78% drop in pump-related smoking incidents within 90 days.' Ask: 'Are you the right person for this, or should I be talking to your loss prevention team?' Under 70 words.",
  },
  {
    stepOrder: 3,
    delayDays: 7,
    subject: "Last note from Sienovo",
    promptHint: `Breakup email. Acknowledge they're busy. One sentence: "If this isn't a priority I'll stop bothering you — just reply with a no, or 'loop in X' if you have a colleague who handles this." Under 50 words.`,
  },
];

for (const s of steps) {
  const stepId =
    "stp" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await client.query(
    `INSERT INTO "OutreachStep" (
       id, "campaignId", "stepOrder", "delayDays", subject, "promptHint", "createdAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [stepId, campaignId, s.stepOrder, s.delayDays, s.subject, s.promptHint],
  );
}
console.log(`Created ${steps.length} steps.`);

await client.end();
