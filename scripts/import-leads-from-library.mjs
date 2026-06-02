#!/usr/bin/env node
/**
 * Import potential customers from the AutoClaw enterprise resource library
 * (S3) into sienovo-intl's CRM, so scraped leads become outreach targets.
 *
 * Flow per lead (one lead = one company + a few contacts):
 *   1. Upsert the COMPANY into "Company" (dedupe by name, fill only empties).
 *   2. For each contact: if it has no email, optionally resolve one via Apollo
 *      /people/match (name + company + domain). With an email, upsert into
 *      "Contact" as a lead (source=autoclaw-library, isLead=true, linked to the
 *      company) and push to Brevo list 5. No email -> company is still saved.
 *
 * The Contact model requires a unique email, so email-less scraped contacts
 * can't become Contacts — that's why companies land regardless and contacts
 * only when an email exists or can be resolved.
 *
 * Usage:
 *   node scripts/import-leads-from-library.mjs                       # today, all segments
 *   node scripts/import-leads-from-library.mjs --date 2026-05-31
 *   node scripts/import-leads-from-library.mjs --segments oem-brands
 *   node scripts/import-leads-from-library.mjs --no-resolve-email    # skip Apollo email reveal
 *   node scripts/import-leads-from-library.mjs --dry-run
 *
 * Env required:
 *   DATABASE_URL                              (CRM)
 *   LEADS_BUCKET                              (S3 resource-library bucket)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (S3 read; ambient on Lambda/Actions)
 *   APOLLO_API_KEY                            (email resolution; optional)
 *   BREVO_API_KEY                             (push-back; optional)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const CLIENT = "sienovo-intl";
const SEGMENTS = ["system-integrators", "hardware-distributors", "end-users", "oem-brands"];
const APOLLO_API_URL = "https://api.apollo.io/api/v1";

const args = process.argv.slice(2);
const opt = (flag, def = null) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : def;
};
const date = opt("--date", new Date().toISOString().split("T")[0]);
const segments = opt("--segments") ? opt("--segments").split(",") : SEGMENTS;
const resolveEmail = !args.includes("--no-resolve-email");
const dryRun = args.includes("--dry-run");

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing"); process.exit(1); }
const BUCKET = process.env.LEADS_BUCKET;
if (!BUCKET) { console.error("LEADS_BUCKET missing"); process.exit(1); }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

async function readSegment(segment) {
  const Key = `${CLIENT}/${segment}/leads-${date}.json`;
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key }));
    return JSON.parse(await res.Body.transformToString());
  } catch (err) {
    console.warn(`  [s3] ${Key} not found (${err.name})`);
    return [];
  }
}

/** Apollo /people/match — reveal an email from name + company + domain. */
async function resolveContactEmail(name, company, domain) {
  if (!process.env.APOLLO_API_KEY) return null;
  const [firstName, ...rest] = (name || "").trim().split(/\s+/);
  const body = {
    ...(firstName && { first_name: firstName }),
    ...(rest.length && { last_name: rest.join(" ") }),
    ...(company && { organization_name: company }),
    ...(domain && { domain }),
  };
  if (!firstName) return null;
  try {
    const res = await fetch(`${APOLLO_API_URL}/people/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": process.env.APOLLO_API_KEY, accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const p = (await res.json()).person;
    return p?.email || null;
  } catch { return null; }
}

async function pushToBrevo(c) {
  if (!process.env.BREVO_API_KEY) return false;
  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: c.email,
      attributes: {
        FIRSTNAME: c.firstName || "", LASTNAME: c.lastName || "", COMPANY: c.company || "",
        JOB_TITLE: c.jobTitle || "", INDUSTRY: c.industry || "", LINKEDIN: c.linkedinUrl || "",
        COUNTRY: c.country || "", CITY: c.city || "",
      },
      listIds: [5], updateEnabled: true,
    }),
  });
  return res.ok;
}

async function upsertCompany(lead) {
  // Dedupe by unique name; fill only empty columns on conflict.
  const r = await client.query(
    `INSERT INTO "Company" (id, name, website, industry, size, "linkedinUrl", country, "createdAt", "updatedAt")
     VALUES ('co' || substr(md5(random()::text || clock_timestamp()::text), 1, 22), $1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET
       website     = COALESCE(NULLIF("Company".website, ''), EXCLUDED.website),
       industry    = COALESCE(NULLIF("Company".industry, ''), EXCLUDED.industry),
       size        = COALESCE(NULLIF("Company".size, ''), EXCLUDED.size),
       "linkedinUrl" = COALESCE(NULLIF("Company"."linkedinUrl", ''), EXCLUDED."linkedinUrl"),
       country     = COALESCE(NULLIF("Company".country, ''), EXCLUDED.country),
       "updatedAt" = NOW()
     RETURNING id`,
    [
      lead.name,
      lead.domain || null,
      lead.industry || null,
      lead.employeeCount ? String(lead.employeeCount) : null,
      lead.linkedinUrl || null,
      lead.country || null,
    ]
  );
  return r.rows[0].id;
}

async function upsertContact(c, companyId) {
  await client.query(
    `INSERT INTO "Contact" (id, email, "firstName", "lastName", "jobTitle", company, industry,
        country, "linkedinUrl", "companyWebsite", source, "isLead", "companyId", "createdAt", "updatedAt")
     VALUES ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'autoclaw-library', true, $10, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET
        "jobTitle"      = COALESCE(NULLIF("Contact"."jobTitle", ''), EXCLUDED."jobTitle"),
        company         = COALESCE(NULLIF("Contact".company, ''), EXCLUDED.company),
        industry        = COALESCE(NULLIF("Contact".industry, ''), EXCLUDED.industry),
        country         = COALESCE(NULLIF("Contact".country, ''), EXCLUDED.country),
        "linkedinUrl"   = COALESCE(NULLIF("Contact"."linkedinUrl", ''), EXCLUDED."linkedinUrl"),
        "companyWebsite"= COALESCE(NULLIF("Contact"."companyWebsite", ''), EXCLUDED."companyWebsite"),
        "companyId"     = COALESCE("Contact"."companyId", EXCLUDED."companyId"),
        "isLead"        = true,
        "updatedAt"     = NOW()`,
    [c.email, c.firstName, c.lastName, c.jobTitle, c.company, c.industry, c.country, c.linkedinUrl, c.companyWebsite, companyId]
  );
}

const totals = { leads: 0, companies: 0, contactsWithEmail: 0, resolved: 0, contactsImported: 0, pushed: 0, noEmail: 0 };

console.log(`Importing ${CLIENT} leads — date=${date}, segments=[${segments.join(", ")}]${dryRun ? " [DRY RUN]" : ""}`);

for (const segment of segments) {
  const leads = await readSegment(segment);
  console.log(`\n[${segment}] ${leads.length} leads`);
  for (const lead of leads) {
    totals.leads++;
    let companyId = null;
    if (!dryRun) companyId = await upsertCompany(lead);
    totals.companies++;

    for (const ct of lead.contacts || []) {
      const [firstName, ...rest] = (ct.name || "").trim().split(/\s+/);
      let email = ct.email || null;
      if (!email && resolveEmail) {
        email = await resolveContactEmail(ct.name, lead.name, lead.domain);
        if (email) totals.resolved++;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!email) { totals.noEmail++; continue; }

      const contact = {
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
        jobTitle: ct.title || null,
        company: lead.name,
        industry: lead.industry || null,
        country: lead.country || null,
        linkedinUrl: ct.linkedinUrl || null,
        companyWebsite: lead.domain || null,
      };
      if (ct.email) totals.contactsWithEmail++;
      if (!dryRun) {
        await upsertContact(contact, companyId);
        if (await pushToBrevo(contact)) totals.pushed++;
      }
      totals.contactsImported++;
      console.log(`  ✓ ${contact.company} → ${contact.email} (${contact.jobTitle || "?"})`);
    }
  }
}

console.log(`\n--- Summary ---`);
console.log(`Leads read:            ${totals.leads}`);
console.log(`Companies upserted:    ${totals.companies}`);
console.log(`Emails pre-existing:   ${totals.contactsWithEmail}`);
console.log(`Emails resolved (Apollo): ${totals.resolved}`);
console.log(`Contacts imported:     ${totals.contactsImported}`);
console.log(`Pushed to Brevo:       ${totals.pushed}`);
console.log(`Contacts w/o email:    ${totals.noEmail}`);

await client.end();
