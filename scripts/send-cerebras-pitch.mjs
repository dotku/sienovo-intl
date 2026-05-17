#!/usr/bin/env node

/**
 * Send the Sienovo → Cerebras partnership pitch via Brevo.
 *
 * From: collin.liu@sienovo.cn (Sales Director, Sienovo)
 * To:   info@cerebras.ai     (official inbox, ATTN: Alan Chhabra)
 *       alan@cerebras.net    (guessed direct, fallback)
 * CC:   jay.lin@sienovo.cn
 *
 * Why both To recipients? info@ is Cerebras's verified inbox so the
 * email always lands somewhere humans read; alan@ is the firstname@
 * pattern guess for the EVP Worldwide Partners — even if it bounces
 * it doesn't poison the info@ delivery.
 *
 * Usage: node scripts/send-cerebras-pitch.mjs [--dry-run]
 */

import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

const DRY = process.argv.includes("--dry-run");

const SENDER = {
  email: "collin.liu@sienovo.cn",
  name: "Collin Liu",
};
const REPLY_TO = { email: "collin.liu@sienovo.cn", name: "Collin Liu" };
const TO = [
  { email: "info@cerebras.ai", name: "Cerebras team — ATTN Alan Chhabra" },
  { email: "alan@cerebras.net", name: "Alan Chhabra" },
];
const CC = [{ email: "jay.lin@sienovo.cn", name: "Jay Lin" }];

const SUBJECT =
  "Sienovo — China hardware integration & sovereign-AI distribution partnership (ATTN: Alan Chhabra)";

const HTML = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#1a1a1a;line-height:1.55;max-width:640px;margin:0;padding:0;">

<p>Dear Cerebras team — please forward to <strong>Alan Chhabra (EVP, Worldwide Partners)</strong>,</p>

<p>I'm Collin Liu, Sales Director at <strong>Sienovo (深圳信迈)</strong>, a Chinese hardware integrator shipping rack-scale AI training and inference systems into the China market. We work with research institutions, LLM startups, and mid-size cloud operators who currently buy our 4U / 4-GPU servers — and we're hearing consistent demand for higher per-rack throughput than NVIDIA multi-GPU configurations can deliver.</p>

<p><strong>Sienovo's reference production platform (one configuration we ship at volume):</strong></p>

<table style="border-collapse:collapse;font-size:14px;margin:8px 0 16px 0;">
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Chassis</td><td style="padding:3px 0;">4U Intel-platform, 4-GPU + 12-bay</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Compute</td><td style="padding:3px 0;">2× Intel Xeon 6530 (64C / 270 W each)</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Memory</td><td style="padding:3px 0;">512 GB DDR5-5600</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Accelerators</td><td style="padding:3px 0;">4× NVIDIA RTX 4090 48 GB</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Storage</td><td style="padding:3px 0;">~8.6 TB U.2 NVMe (boot + data tier)</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Network</td><td style="padding:3px 0;">25 GbE dual-port</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Power</td><td style="padding:3px 0;">2× 2200 W (1+1 redundant)</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#525252;">Form factor</td><td style="padding:3px 0;">760 × 433 × 176.5 mm</td></tr>
</table>

<p><strong>Three angles where Sienovo could add value to Cerebras's APAC and sovereign-AI motion:</strong></p>

<ol style="padding-left:20px;">
<li style="margin-bottom:10px;"><strong>China integrator / reseller.</strong> We handle customs, deployment, after-sales, and Chinese-language enablement — markets where non-resident vendors typically face friction. Our customer base is already conditioned to buy GPU-class AI hardware.</li>

<li style="margin-bottom:10px;"><strong>Co-developed chassis &amp; integration SKU.</strong> Our mechanical / thermal team has shipped 4U-and-up systems with redundant 2200 W power and high-density NVMe topology — applicable to WSE-class accelerators or hybrid Cerebras + general-compute boxes.</li>

<li style="margin-bottom:10px;"><strong>Sovereign-AI deployments.</strong> Several of our customers explicitly want a non-NVIDIA path for regulatory or supply-chain reasons — a segment where Cerebras's positioning is uniquely aligned.</li>
</ol>

<p>Would Alan or someone on the partnerships team have <strong>30 minutes for an introductory call in the next 2-3 weeks</strong>? I'm happy to share more customer profiles, deployment references, and a detailed technical brief under NDA.</p>

<p>Best regards,<br>
<strong>Collin Liu</strong><br>
Sales Director, Sienovo / 深圳信迈<br>
collin.liu@sienovo.cn<br>
<a href="https://sienovo.jytech.us">https://sienovo.jytech.us</a></p>

</body></html>`;

const TEXT = `Dear Cerebras team — please forward to Alan Chhabra (EVP, Worldwide Partners),

I'm Collin Liu, Sales Director at Sienovo (深圳信迈), a Chinese hardware
integrator shipping rack-scale AI training and inference systems into the
China market. We work with research institutions, LLM startups, and mid-size
cloud operators who currently buy our 4U / 4-GPU servers — and we're hearing
consistent demand for higher per-rack throughput than NVIDIA multi-GPU
configurations can deliver.

Sienovo's reference production platform (one configuration we ship at volume):

  Chassis      4U Intel-platform, 4-GPU + 12-bay
  Compute      2× Intel Xeon 6530 (64C / 270W each)
  Memory       512 GB DDR5-5600
  Accelerators 4× NVIDIA RTX 4090 48 GB
  Storage      ~8.6 TB U.2 NVMe (boot + data tier)
  Network      25 GbE dual-port
  Power        2× 2200 W (1+1 redundant)
  Form factor  760 × 433 × 176.5 mm

Three angles where Sienovo could add value to Cerebras's APAC and
sovereign-AI motion:

  1. China integrator / reseller. We handle customs, deployment,
     after-sales, and Chinese-language enablement — markets where
     non-resident vendors typically face friction. Our customer base is
     already conditioned to buy GPU-class AI hardware.

  2. Co-developed chassis & integration SKU. Our mechanical / thermal team
     has shipped 4U-and-up systems with redundant 2200 W power and
     high-density NVMe topology — applicable to WSE-class accelerators or
     hybrid Cerebras + general-compute boxes.

  3. Sovereign-AI deployments. Several of our customers explicitly want a
     non-NVIDIA path for regulatory or supply-chain reasons — a segment
     where Cerebras's positioning is uniquely aligned.

Would Alan or someone on the partnerships team have 30 minutes for an
introductory call in the next 2-3 weeks? I'm happy to share more customer
profiles, deployment references, and a detailed technical brief under NDA.

Best regards,
Collin Liu
Sales Director, Sienovo / 深圳信迈
collin.liu@sienovo.cn
https://sienovo.jytech.us`;

const payload = {
  sender: SENDER,
  replyTo: REPLY_TO,
  to: TO,
  cc: CC,
  subject: SUBJECT,
  htmlContent: HTML,
  textContent: TEXT,
  tags: ["outreach", "partnership", "cerebras", `${new Date().toISOString().slice(0, 10)}`],
  headers: {
    "X-Sienovo-Campaign": "cerebras-partnership-pitch",
  },
};

console.log("=== Email payload preview ===");
console.log(`From:    ${payload.sender.name} <${payload.sender.email}>`);
console.log(`Reply-To: ${payload.replyTo.email}`);
console.log(`To:      ${payload.to.map((r) => r.email).join(", ")}`);
console.log(`Cc:      ${payload.cc.map((r) => r.email).join(", ")}`);
console.log(`Subject: ${payload.subject}`);
console.log(`\nText preview (first 400c):\n${TEXT.slice(0, 400)}…\n`);

if (DRY) {
  console.log("(dry-run) Not sending.");
  process.exit(0);
}

const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": process.env.BREVO_API_KEY,
    "Content-Type": "application/json",
    accept: "application/json",
  },
  body: JSON.stringify(payload),
});
const text = await res.text();
if (!res.ok) {
  console.error(`\nBrevo ${res.status}: ${text}`);
  process.exit(1);
}
console.log(`\n✓ Sent. ${text}`);
