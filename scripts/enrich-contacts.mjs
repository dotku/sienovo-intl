#!/usr/bin/env node
/**
 * Auto-enrich Contacts that are missing firmographic data, then push the
 * enriched record back to Brevo. The manual flow lives at
 * /admin/apollo/enrich (preview → approve); this is the unattended version
 * for the daily GitHub Action.
 *
 * For each Contact missing company OR jobTitle, look it up in Apollo
 * (/people/match by email + name + company), fill ONLY the empty fields
 * (never clobber data a human/Brevo already set), persist, and upsert to
 * Brevo with updateEnabled so the attributes flow back to the email platform.
 *
 * Usage:
 *   node scripts/enrich-contacts.mjs                 # default batch
 *   node scripts/enrich-contacts.mjs --limit 50      # batch size
 *   node scripts/enrich-contacts.mjs --dry-run       # no DB / Brevo writes
 *
 * Env required:
 *   DATABASE_URL, APOLLO_API_KEY        (enrichment)
 *   BREVO_API_KEY                       (push-back; skipped if absent)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";

const APOLLO_API_URL = "https://api.apollo.io/api/v1";
const DEFAULT_LIMIT = 25;

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : DEFAULT_LIMIT;
const dryRun = args.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing in env");
  process.exit(1);
}
if (!process.env.APOLLO_API_KEY) {
  console.error("APOLLO_API_KEY missing in env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

/** Apollo person match — same endpoint the manual enrich + pull-leads use. */
async function apolloMatch({ email, firstName, lastName, company }) {
  const body = {
    ...(email && { email }),
    ...(firstName && { first_name: firstName }),
    ...(lastName && { last_name: lastName }),
    ...(company && { organization_name: company }),
  };
  if (Object.keys(body).length === 0) return null;

  const res = await fetch(`${APOLLO_API_URL}/people/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": process.env.APOLLO_API_KEY,
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const p = data.person;
  if (!p) return null;

  return {
    firstName: p.first_name || null,
    lastName: p.last_name || null,
    jobTitle: p.title || null,
    company: p.organization?.name || null,
    industry: p.organization?.industry || null,
    linkedinUrl: p.linkedin_url || null,
    city: p.city || null,
    country: p.country || null,
    companyWebsite: p.organization?.website_url || null,
    companySize: p.organization?.estimated_num_employees
      ? String(p.organization.estimated_num_employees)
      : null,
  };
}

/** Push enriched contact back to Brevo (same shape as lib/contacts-sync). */
async function pushToBrevo(contact) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  const listIds = contact.isLead ? [5] : [5];
  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: contact.email,
      attributes: {
        FIRSTNAME: contact.firstName || "",
        LASTNAME: contact.lastName || "",
        COMPANY: contact.company || "",
        JOB_TITLE: contact.jobTitle || "",
        INDUSTRY: contact.industry || "",
        LINKEDIN: contact.linkedinUrl || "",
        COUNTRY: contact.country || "",
        CITY: contact.city || "",
      },
      listIds,
      updateEnabled: true,
    }),
  });
  return res.ok;
}

// Contacts missing core firmographics — oldest-updated first so repeated
// daily runs cycle through the backlog instead of retrying the same head.
const { rows } = await client.query(
  `SELECT id, email, "firstName", "lastName", "jobTitle", company, industry,
          city, country, "linkedinUrl", "companyWebsite", "companySize", "isLead"
   FROM "Contact"
   WHERE (company IS NULL OR company = '' OR "jobTitle" IS NULL OR "jobTitle" = '')
     AND email IS NOT NULL AND email <> ''
   ORDER BY "updatedAt" ASC
   LIMIT $1`,
  [limit]
);

console.log(`Found ${rows.length} contacts needing enrichment (limit ${limit})${dryRun ? " [DRY RUN]" : ""}`);

const totals = { scanned: 0, enriched: 0, noMatch: 0, pushed: 0, errors: 0 };
const FILLABLE = ["firstName", "lastName", "jobTitle", "company", "industry", "linkedinUrl", "city", "country", "companyWebsite", "companySize"];

for (const c of rows) {
  totals.scanned++;
  try {
    const apollo = await apolloMatch({
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
    });
    if (!apollo) { totals.noMatch++; await sleep(500); continue; }

    // Fill ONLY currently-empty fields — never overwrite existing data.
    const updates = {};
    for (const f of FILLABLE) {
      const cur = c[f];
      if ((cur === null || cur === "") && apollo[f]) updates[f] = apollo[f];
    }
    if (Object.keys(updates).length === 0) { totals.noMatch++; await sleep(500); continue; }

    const merged = { ...c, ...updates };

    if (!dryRun) {
      const cols = Object.keys(updates);
      const setSql = cols.map((col, i) => `"${col}" = $${i + 2}`).join(", ");
      await client.query(
        `UPDATE "Contact" SET ${setSql}, "updatedAt" = NOW() WHERE id = $1`,
        [c.id, ...cols.map((col) => updates[col])]
      );
      if (await pushToBrevo(merged)) totals.pushed++;
    }
    totals.enriched++;
    console.log(`  ✓ ${c.email}  +{${Object.keys(updates).join(", ")}}`);
    await sleep(500); // Apollo rate limit
  } catch (err) {
    totals.errors++;
    console.error(`  ✗ ${c.email}: ${err.message}`);
  }
}

console.log(`\n--- Summary ---`);
console.log(`Scanned:        ${totals.scanned}`);
console.log(`Enriched:       ${totals.enriched}`);
console.log(`Pushed to Brevo:${totals.pushed}`);
console.log(`No match/empty: ${totals.noMatch}`);
console.log(`Errors:         ${totals.errors}`);

await client.end();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
