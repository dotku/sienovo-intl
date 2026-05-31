/**
 * Seed 4 outreach campaigns — one per customer type for sienovo-intl edge-AI
 * hardware. Each campaign carries a DIFFERENT strategy (productFocus + aiContext
 * + targeting); outreach-draft.mjs then personalizes per company via Firecrawl
 * research on top of that strategy. This is the "每个客户不同策略" mechanism.
 *
 * Created as status="draft" on purpose — NOTHING sends until you:
 *   1. clear the compliance gate (Apollo/Brevo DPA + RoPA + opt-out) — see
 *      autoclaw-data-scraper/docs/architecture-design.md §13/ADR-11,
 *   2. confirm the Brevo sender (collin.liu@sienovo.cn) + sienovo.cn SPF/DKIM,
 *   3. flip a campaign to status="active".
 *
 * Re-runnable: upserts each campaign by name; steps are recreated cleanly.
 * Run:  npx tsx scripts/seed-outreach-sienovo-intl.ts
 */

import { prisma } from "../src/lib/prisma";

const COUNTRIES = "United States, Canada, United Kingdom, Germany, Australia";

const CAMPAIGNS = [
  {
    name: "Edge AI for System Integrators",
    segment: "system-integrators",
    targetIndustries:
      "Security, Video Surveillance, Physical Security, Systems Integration, Smart City, Building Automation, Machine Vision",
    targetTitles:
      "CEO, Founder, CTO, VP Engineering, Solutions Director, Technical Director, Head of Product, Procurement Manager",
    productFocus:
      "INT-AIBOX edge AI analytics box as the AI layer integrators add on TOP of the cameras/VMS they already deploy — real-time video analytics, intrusion, people/vehicle detection, on-prem, no cloud roundtrip.",
    aiContext:
      "Audience = system integrators / solution providers who already build surveillance, smart-city or automation solutions. Angle: partner margin + faster delivery, NOT rip-and-replace. Position INT-AIBOX as the analytics component they resell/integrate and can OEM. Technical depth lands here: RK3588 NPU, runs on-prem, alerts <500ms, ONVIF/RTSP camera-agnostic. Common objection 'we already have cameras / our own software' → frame as the edge-AI layer that upgrades their existing stack and wins them new analytics revenue.",
    steps: [
      {
        order: 1,
        delay: 0,
        subject: "Edge AI analytics layer for {company}'s deployments",
        hint: "Lead with: most integrators bolt analytics on as an afterthought; INT-AIBOX is the camera-agnostic edge-AI layer you resell on top of existing CCTV/VMS. One concrete capability (real-time intrusion or people/vehicle detection, on-prem <500ms). Close: 'Worth 15 min on how integrators are adding this as a margin line?' Under 100 words.",
      },
      {
        order: 2,
        delay: 3,
        subject: "Re: edge AI analytics layer",
        hint: "Short follow-up. One proof point: '600+ on-prem deployments; integrators typically attach it to cameras they already sell, no rip-and-replace.' Ask if they're the right person or if it's their solutions/engineering lead. Under 70 words.",
      },
      {
        order: 3,
        delay: 7,
        subject: "Last note from Sienovo",
        hint: "Breakup email. 'If edge analytics isn't on your roadmap I'll stop here — a quick no is fine, or point me to whoever owns it.' Under 50 words.",
      },
    ],
  },
  {
    name: "Embedded & IoT Hardware for Distributors",
    segment: "hardware-distributors",
    targetIndustries:
      "Electronics Distribution, Embedded Systems, Industrial Automation, IoT, Computer Hardware, Wholesale Electronics",
    targetTitles:
      "CEO, Owner, Purchasing Manager, Product Manager, Category Manager, Business Development, Procurement Director",
    productFocus:
      "INT-AIBOX-RK-4 industrial edge-AI box and XM3588-GW01 IoT gateway (RK3588) as additions to your line card — volume pricing, datasheets, stable supply, healthy reseller margin.",
    aiContext:
      "Audience = electronics/embedded distributors and traders who RESELL hardware, they don't deploy it. Angle: line-card expansion + margin + rising RK3588 demand. Talk SKUs, MOQ, volume tiers, datasheets, lead times, supply reliability. Avoid end-user ROI talk — they care about sell-through and margin. Offer a datasheet + sample/eval unit as the CTA.",
    steps: [
      {
        order: 1,
        delay: 0,
        subject: "RK3588 edge-AI boxes for {company}'s line card",
        hint: "Lead: RK3588 industrial edge-AI boxes & IoT gateways with reseller margin and stable supply — a fast-growing category. Offer datasheet + volume pricing. Close: 'Want the line-card sheet + sample pricing?' Under 90 words. No end-user ROI fluff.",
      },
      {
        order: 2,
        delay: 3,
        subject: "Re: RK3588 line card",
        hint: "Follow-up. One hook: 'We support eval units + tiered volume pricing; typical reseller margin is healthy on this category.' Ask who owns new line-card decisions. Under 60 words.",
      },
      {
        order: 3,
        delay: 7,
        subject: "Last note",
        hint: "Breakup. 'If embedded edge-AI isn't a fit for your catalog, a quick no is perfect — or point me to your category buyer.' Under 50 words.",
      },
    ],
  },
  {
    name: "Edge AI for Operations (End Users)",
    segment: "end-users",
    targetIndustries:
      "Manufacturing, Industrial Automation, Retail, Logistics, Food & Beverage, Warehousing",
    targetTitles:
      "VP Operations, Director of Operations, Plant Manager, Head of Manufacturing, Director of IT, Innovation Manager, CTO",
    productFocus:
      "Turnkey edge AI on INT-AIBOX: automated quality inspection, worker-safety/PPE detection, and retail people-counting & analytics — on-prem, real-time, no cloud.",
    aiContext:
      "Audience = enterprises that DEPLOY (factories, retailers, logistics), not resellers. Angle: operational ROI — defect/scrap reduction, safety-incident reduction, labor savings — and on-prem data privacy. Concrete: real-time detection on the line vs. after-the-fact review. Objection 'integration effort/IT burden' → turnkey appliance, works with existing cameras. CTA: a scoped pilot on one line/site.",
    steps: [
      {
        order: 1,
        delay: 0,
        subject: "Real-time quality/safety detection at {company}",
        hint: "Lead with one operational pain (defect escapes OR safety incidents OR manual monitoring cost). INT-AIBOX catches it in real-time on-prem vs. after-the-fact. Close: 'Open to a scoped pilot on one line/site?' Under 100 words. Pick the angle from their industry.",
      },
      {
        order: 2,
        delay: 3,
        subject: "Re: real-time detection pilot",
        hint: "Follow-up with a number: 'A comparable deployment cut [defect escapes / safety incidents] meaningfully within 90 days, fully on-prem.' Ask if ops or IT owns this. Under 70 words.",
      },
      {
        order: 3,
        delay: 7,
        subject: "Last note from Sienovo",
        hint: "Breakup. 'If this isn't a priority this quarter I'll stop — reply no, or loop in whoever owns plant/store operations.' Under 50 words.",
      },
    ],
  },
  {
    name: "White-label Edge AI (OEM / ODM)",
    segment: "oem-brands",
    targetIndustries:
      "Electronics Manufacturing, OEM, ODM, Contract Manufacturing, Consumer Electronics, Product Design",
    targetTitles:
      "CEO, Founder, Head of Product, VP Product, Sourcing Manager, Engineering Director, Director of Hardware",
    productFocus:
      "White-label / ODM edge-AI hardware — brand the INT-AIBOX / XM3588 (RK3588) platform as your own: custom enclosure, firmware, and BOM optimization, manufactured at scale.",
    aiContext:
      "Audience = brands / OEM-ODM players who want edge-AI hardware under THEIR brand. Angle: branding + customization + BOM cost + time-to-market, backed by China manufacturing scale. Talk NRE, MOQ, customization scope (enclosure/firmware/IO), and a reference platform to start from. CTA: share the reference-design brief + a customization scoping call.",
    steps: [
      {
        order: 1,
        delay: 0,
        subject: "White-label edge AI under {company}'s brand",
        hint: "Lead: skip 12+ months of edge-AI hardware R&D — start from a proven RK3588 reference platform and ship it under your brand (custom enclosure/firmware/IO). Close: 'Want the reference-design brief?' Under 100 words.",
      },
      {
        order: 2,
        delay: 3,
        subject: "Re: white-label edge AI",
        hint: "Follow-up. One hook: 'We handle enclosure, firmware and BOM optimization at scale — you own the brand and the customer.' Ask who owns product/hardware sourcing. Under 60 words.",
      },
      {
        order: 3,
        delay: 7,
        subject: "Last note",
        hint: "Breakup. 'If a white-label edge-AI line isn't on your roadmap, a quick no works — or point me to your product lead.' Under 50 words.",
      },
    ],
  },
];

async function main() {
  for (const c of CAMPAIGNS) {
    const data = {
      name: c.name,
      status: "draft", // safe: nothing sends until reviewed + activated
      targetIndustries: c.targetIndustries,
      targetTitles: c.targetTitles,
      targetCountries: COUNTRIES,
      targetDomains: "",
      // Use the Brevo-verified default sender (collin.liu@sienovo.cn).
      senderName: "Collin Liu, Sienovo",
      senderEmail: "collin.liu@sienovo.cn",
      replyTo: "collin.liu@sienovo.cn",
      productFocus: c.productFocus,
      aiContext: c.aiContext,
    };

    const existing = await prisma.outreachCampaign.findFirst({ where: { name: c.name } });
    const campaign = existing
      ? await prisma.outreachCampaign.update({ where: { id: existing.id }, data })
      : await prisma.outreachCampaign.create({ data });
    console.log(`${existing ? "Updated" : "Created"} [${c.segment}] ${campaign.name} (${campaign.id}) — status=draft`);

    await prisma.outreachStep.deleteMany({ where: { campaignId: campaign.id } });
    for (const s of c.steps) {
      await prisma.outreachStep.create({
        data: {
          campaignId: campaign.id,
          stepOrder: s.order,
          delayDays: s.delay,
          subject: s.subject,
          promptHint: s.hint,
        },
      });
    }
    console.log(`  + ${c.steps.length}-step sequence`);
  }

  console.log(
    `\nSeeded 4 draft campaigns. Before going live:\n` +
      `  1. Clear compliance gate (Apollo/Brevo DPA + RoPA + opt-out) — ADR-11.\n` +
      `  2. Confirm Brevo sender collin.liu@sienovo.cn + sienovo.cn SPF/DKIM.\n` +
      `  3. Set ONE campaign status="active", then:\n` +
      `     node scripts/import-leads-from-library.mjs   # leads + emails into CRM\n` +
      `     node scripts/outreach-draft.mjs --limit 5     # AI drafts (review them!)\n` +
      `     node scripts/outreach-send.mjs --dry-run\n`
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
