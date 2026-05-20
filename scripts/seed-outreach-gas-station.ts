/**
 * Seed the first live outreach campaign: Smart Gas Station — US/Canada.
 *
 * Why this scenario first?
 *  - Sienovo has the most concrete proof-points here (smoking detection,
 *    phone-use-while-pumping, fire alarm) — easy to write specific copy.
 *  - Buyers are well-defined: ops directors + loss prevention at fuel /
 *    convenience chains.
 *  - ROI is calculable (one fire prevented pays back the device 100×).
 *
 * Re-runnable: upserts the campaign by name. Steps are recreated cleanly.
 */

import { prisma } from "../src/lib/prisma";

const CAMPAIGN_NAME = "Smart Gas Station — US/CA";

async function main() {
  // Upsert campaign
  const existing = await prisma.outreachCampaign.findFirst({
    where: { name: CAMPAIGN_NAME },
  });

  const campaignData = {
    name: CAMPAIGN_NAME,
    status: "active",
    targetIndustries:
      "Oil & Gas, Petroleum, Convenience Stores, Fuel Retail, Gas Station",
    targetTitles:
      "Operations Director, Director of Operations, VP Operations, Loss Prevention Manager, Director of Loss Prevention, Risk Manager, IT Director, Head of Safety, Director of Risk Management",
    targetCountries: "United States, Canada",
    targetDomains: "", // we let Apollo's industry+title+geo filter do the work
    senderName: "Leo from Sienovo",
    senderEmail: "leo@sienovo.cn",
    replyTo: "collin.liu@sienovo.cn",
    productFocus:
      "INT-AIBOX-P-8 for smart gas station safety — real-time smoking detection, phone-use-while-pumping alerts, intrusion/loitering after hours, and fire/smoke detection at fuel islands.",
    aiContext:
      "Sienovo's INT-AIBOX runs on-prem at the station — no cloud roundtrip, alerts fire in <500ms. Most US/CA fuel retailers run video for after-the-fact incident review; we shift it to real-time prevention. Concrete deployments: 600+ stations across China with smoking/phone-use detection; insurance loss-claim reduction is the typical ROI angle. Common objections: 'we already have cameras' — frame edge AI as the analytics layer on top of cameras they have, not a rip-and-replace.",
  };

  const campaign = existing
    ? await prisma.outreachCampaign.update({
        where: { id: existing.id },
        data: campaignData,
      })
    : await prisma.outreachCampaign.create({ data: campaignData });

  console.log(
    `${existing ? "Updated" : "Created"} campaign: ${campaign.name} (${campaign.id})`,
  );

  // Wipe existing steps and recreate so re-running gives a clean state
  await prisma.outreachStep.deleteMany({ where: { campaignId: campaign.id } });

  const step1 = await prisma.outreachStep.create({
    data: {
      campaignId: campaign.id,
      stepOrder: 1,
      delayDays: 0,
      subject: "Smoking/phone detection at {company}'s pumps",
      promptHint:
        "Lead with the specific risk: smoking or phone use at the pump is the single biggest fire-cause for fuel retail. Mention edge AI catches it in real-time vs. their cameras catching it post-incident. End with: 'Worth a 15-min look at how Chevron/Shell-tier operators are deploying this?' Keep it under 100 words.",
    },
  });

  const step2 = await prisma.outreachStep.create({
    data: {
      campaignId: campaign.id,
      stepOrder: 2,
      delayDays: 3,
      subject: "Re: smoking detection",
      promptHint:
        "Brief follow-up. Reference the first email. Drop one specific data point: 'A 200-station deployment in Asia is reporting a 78% drop in pump-related smoking incidents within 90 days.' Ask: 'Are you the right person for this, or should I be talking to your loss prevention team?' Under 70 words.",
    },
  });

  const step3 = await prisma.outreachStep.create({
    data: {
      campaignId: campaign.id,
      stepOrder: 3,
      delayDays: 7,
      subject: "Last note from Sienovo",
      promptHint:
        `Breakup email. Acknowledge they're busy. One sentence: "If this isn't a priority I'll stop bothering you — just reply with a no, or 'loop in X' if you have a colleague who handles this." Under 50 words.`,
    },
  });

  console.log(
    `Created 3-step sequence: ${step1.id}, ${step2.id}, ${step3.id}`,
  );
  console.log(
    `\nNext steps:\n` +
      `  1. Confirm Brevo has authenticated sienovo.cn (SPF + DKIM).\n` +
      `  2. node scripts/outreach-pull-leads.mjs --campaign ${campaign.id} --per-run 25\n` +
      `  3. node scripts/outreach-draft.mjs --campaign ${campaign.id} --limit 5\n` +
      `  4. node scripts/outreach-send.mjs --dry-run\n` +
      `  5. Visually inspect 1-2 drafts in OutreachEmail before live send.\n`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
