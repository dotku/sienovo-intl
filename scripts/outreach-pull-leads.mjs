#!/usr/bin/env node
/**
 * Pull leads from Apollo for every active OutreachCampaign and write them
 * into the `Contact` table. Dedupes by email so re-running is safe.
 *
 * Each campaign's `targetTitles` + `targetCountries` + `targetIndustries`
 * fields drive the Apollo search filters. Pulls up to PER_RUN leads per
 * campaign per invocation; the daily cron picks fresh ones each time.
 *
 * Usage:
 *   node scripts/outreach-pull-leads.mjs                 # all active campaigns
 *   node scripts/outreach-pull-leads.mjs --campaign <id> # one campaign
 *   node scripts/outreach-pull-leads.mjs --per-run 25    # batch size override
 *
 * Env required:
 *   DATABASE_URL, APOLLO_API_KEY
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";

const DEFAULT_PER_RUN = 25;
const APOLLO_API_URL = "https://api.apollo.io/api/v1";

const args = process.argv.slice(2);
const campaignArg = args.indexOf("--campaign");
const perRunArg = args.indexOf("--per-run");
const campaignId = campaignArg !== -1 ? args[campaignArg + 1] : null;
const perRun =
  perRunArg !== -1 ? parseInt(args[perRunArg + 1], 10) : DEFAULT_PER_RUN;

if (!process.env.APOLLO_API_KEY) {
  console.error("APOLLO_API_KEY missing in env");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing in env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

function splitCsv(s) {
  return (s || "")
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function apolloSearch(filters) {
  const body = {
    page: filters.page || 1,
    per_page: Math.min(filters.perPage || 25, 100),
  };
  if (filters.personTitles?.length) body.person_titles = filters.personTitles;
  if (filters.organizationLocations?.length)
    body.organization_locations = filters.organizationLocations;
  if (filters.industryKeywords?.length)
    body.q_organization_keyword_tags = filters.industryKeywords;
  body.contact_email_status = ["verified"];

  const res = await fetch(`${APOLLO_API_URL}/mixed_people/api_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": process.env.APOLLO_API_KEY,
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Apollo search HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Reveal a person's contact info (email + phone) — this is what burns
 * Apollo credits. The `mixed_people/api_search` endpoint returns matches
 * but withholds emails; `people/match` unlocks them one at a time.
 */
async function apolloEnrichPerson(person) {
  // Identify by Apollo ID first (most reliable); fall back to name+org.
  const body = {
    reveal_personal_emails: true,
    id: person.id,
  };

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
  return data.person || null;
}

const campaigns = campaignId
  ? await client.query(
      `SELECT id, name, "targetIndustries", "targetTitles", "targetCountries"
       FROM "OutreachCampaign" WHERE id = $1 AND status = 'active'`,
      [campaignId],
    )
  : await client.query(
      `SELECT id, name, "targetIndustries", "targetTitles", "targetCountries"
       FROM "OutreachCampaign" WHERE status = 'active'`,
    );

if (campaigns.rows.length === 0) {
  console.log("No active campaigns");
  await client.end();
  process.exit(0);
}

const totals = { fetched: 0, inserted: 0, duplicates: 0, missingEmail: 0 };

for (const campaign of campaigns.rows) {
  console.log(`\n=== Campaign: ${campaign.name} (${campaign.id}) ===`);

  const filters = {
    personTitles: splitCsv(campaign.targetTitles),
    organizationLocations: splitCsv(campaign.targetCountries),
    industryKeywords: splitCsv(campaign.targetIndustries),
    perPage: perRun,
    page: 1,
  };

  // Random page in 1..5 so repeated daily runs naturally rotate through
  // Apollo's result set instead of always pulling the same top results.
  filters.page = 1 + Math.floor(Math.random() * 5);

  let people;
  try {
    const result = await apolloSearch(filters);
    people = result.people || [];
    console.log(
      `Apollo returned ${people.length} people (page ${filters.page}, total ${result.pagination?.total_entries ?? "?"})`,
    );
  } catch (err) {
    console.error(`  Search failed: ${err.message}`);
    continue;
  }

  for (const p of people) {
    totals.fetched++;

    // mixed_people/api_search hides email by default — unlock per-person
    // via /people/match. Costs 1 Apollo credit per reveal.
    let person = p;
    if (!person.email) {
      const enriched = await apolloEnrichPerson(p);
      if (enriched) person = { ...p, ...enriched };
    }
    if (!person.email) {
      totals.missingEmail++;
      continue;
    }

    const insertRes = await client.query(
      `INSERT INTO "Contact" (
         id, email, "firstName", "lastName", "jobTitle", company, industry,
         city, country, "linkedinUrl", "companyWebsite", "companySize",
         source, "isLead", "createdAt", "updatedAt"
       )
       VALUES (
         'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         'apollo-outbound', true, NOW(), NOW()
       )
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [
        person.email.toLowerCase(),
        person.first_name || null,
        person.last_name || null,
        person.title || null,
        person.organization?.name || null,
        person.organization?.industry || null,
        person.city || null,
        person.country || null,
        person.linkedin_url || null,
        person.organization?.website_url || null,
        person.organization?.estimated_num_employees
          ? String(person.organization.estimated_num_employees)
          : null,
      ],
    );

    if (insertRes.rows.length > 0) totals.inserted++;
    else totals.duplicates++;
  }
}

console.log(`\n--- Summary ---`);
console.log(`Fetched from Apollo:  ${totals.fetched}`);
console.log(`Inserted (new):       ${totals.inserted}`);
console.log(`Skipped (duplicates): ${totals.duplicates}`);
console.log(`Skipped (no email):   ${totals.missingEmail}`);

await client.end();
