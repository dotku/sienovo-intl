import { prisma } from "../src/lib/prisma";

async function main() {
  // 1. Create campaign
  const campaign = await prisma.outreachCampaign.create({
    data: {
      name: "Manufacturing QC - US & Europe",
      status: "active",
      targetIndustries: "manufacturing, automotive, electronics",
      targetTitles: "VP Operations, Quality Manager, Plant Manager, CTO",
      targetCountries: "United States, Germany, Japan",
      targetDomains: "fictiv.com, jabil.com, flex.com",
      senderName: "Leo from Sienovo",
      senderEmail: "sienovoleo@gmail.com",
      productFocus: "INT-AIBOX-P-8 for manufacturing quality control - real-time defect detection on production lines",
      aiContext:
        "We help manufacturers reduce defect rates by 60%+ using edge AI video analytics. Our AIBOX processes 8 HD camera feeds simultaneously with 40+ built-in algorithms. Emphasize: no cloud dependency, works in harsh factory environments (-20°C to 60°C), easy retrofit to existing lines. Our pricing is competitive vs. Cognex or Keyence solutions.",
    },
  });

  console.log("Campaign created:", campaign.id);

  // 2. Create 3-step email sequence
  const step1 = await prisma.outreachStep.create({
    data: {
      campaignId: campaign.id,
      stepOrder: 1,
      delayDays: 0,
      subject: "Edge AI for [industry] quality control",
      promptHint:
        "Lead with a pain point specific to their industry. Mention that edge AI can catch defects human inspectors miss. Keep it short and curiosity-driven.",
    },
  });

  const step2 = await prisma.outreachStep.create({
    data: {
      campaignId: campaign.id,
      stepOrder: 2,
      delayDays: 3,
      subject: "Quick follow-up",
      promptHint:
        "Reference the first email briefly. Share a specific stat: 'One of our manufacturing clients reduced their defect escape rate from 2.3% to 0.4% within 3 months.' Ask if they'd be open to a 15-min call.",
    },
  });

  const step3 = await prisma.outreachStep.create({
    data: {
      campaignId: campaign.id,
      stepOrder: 3,
      delayDays: 7,
      subject: "Am I reaching the right person?",
      promptHint:
        "Shorter break-up style email. Ask if they're the right person or if there's someone else on their team handling quality/automation decisions. Low pressure, easy to reply to.",
    },
  });

  console.log("Steps created:", step1.id, step2.id, step3.id);

  // 3. Create demo prospects (upsert contacts)
  const demoProspects = [
    {
      email: "demo-sarah@fictiv.com",
      firstName: "Sarah",
      lastName: "Chen",
      company: "Fictiv",
      jobTitle: "VP of Manufacturing Operations",
      industry: "Manufacturing",
      city: "San Francisco",
      country: "United States",
      companySize: "500-1000 employees",
      companyWebsite: "https://fictiv.com",
    },
    {
      email: "demo-markus@siemens-demo.com",
      firstName: "Markus",
      lastName: "Weber",
      company: "Siemens AG",
      jobTitle: "Head of Quality Engineering",
      industry: "Industrial Automation",
      city: "Munich",
      country: "Germany",
      companySize: "10000+ employees",
      companyWebsite: "https://siemens.com",
    },
    {
      email: "demo-takeshi@toyota-demo.com",
      firstName: "Takeshi",
      lastName: "Yamamoto",
      company: "Toyota Motor",
      jobTitle: "Plant Manager",
      industry: "Automotive",
      city: "Toyota City",
      country: "Japan",
      companySize: "10000+ employees",
      companyWebsite: "https://toyota.com",
    },
    {
      email: "demo-jennifer@jabil-demo.com",
      firstName: "Jennifer",
      lastName: "Martinez",
      company: "Jabil Inc",
      jobTitle: "Director of Smart Manufacturing",
      industry: "Electronics Manufacturing",
      city: "St. Petersburg",
      country: "United States",
      companySize: "5000-10000 employees",
      companyWebsite: "https://jabil.com",
    },
    {
      email: "demo-raj@tata-demo.com",
      firstName: "Raj",
      lastName: "Patel",
      company: "Tata Steel",
      jobTitle: "Chief Technology Officer",
      industry: "Steel Manufacturing",
      city: "Mumbai",
      country: "India",
      companySize: "10000+ employees",
      companyWebsite: "https://tatasteel.com",
    },
  ];

  for (const p of demoProspects) {
    const contact = await prisma.contact.upsert({
      where: { email: p.email },
      update: { ...p, isLead: true },
      create: { ...p, source: "outreach", isLead: true },
    });

    await prisma.outreachEmail.create({
      data: {
        campaignId: campaign.id,
        stepId: step1.id,
        contactId: contact.id,
        status: "pending",
      },
    });

    console.log("Added prospect:", p.firstName, p.lastName, "-", p.company);
  }

  console.log("\nDone! Campaign ready at /admin/outreach/" + campaign.id);
  console.log("Next steps:");
  console.log("  1. Go to the campaign page");
  console.log("  2. Click 'Generate' to AI-generate emails");
  console.log("  3. Review drafts in Email Queue");
  console.log("  4. Approve and send");

  await prisma.$disconnect();
}

main().catch(console.error);
