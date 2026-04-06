import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { trackApiUsage } from "@/lib/api-usage";

const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 403 });

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return UNAUTHORIZED;

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { domains, companyName, titles, perPage = 10 } = body;

  if (!domains && !companyName) {
    return NextResponse.json({ error: "domains or companyName required" }, { status: 400 });
  }

  try {
    // Step 1: Apollo search → returns people with obfuscated names + IDs
    const searchBody: Record<string, unknown> = { per_page: perPage };
    if (domains) {
      searchBody.q_organization_domains = domains
        .split(",")
        .map((d: string) => d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
        .join(",");
    } else if (companyName) {
      searchBody.q_organization_name = companyName;
    }
    if (titles) {
      searchBody.person_titles = titles.split(",").map((t: string) => t.trim());
    }

    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      await trackApiUsage("apollo", "outreach_search", false);
      return NextResponse.json({ error: `Apollo search failed: ${res.status}` }, { status: 502 });
    }

    await trackApiUsage("apollo", "outreach_search", true);
    const data = await res.json();
    const people = data.people || [];

    // Step 2: Enrich each person by ID via people/match → reveals full name + email
    const prospects = [];
    for (const p of people.slice(0, 20)) {
      let firstName = p.first_name || "";
      let lastName = p.last_name || "";
      let email = p.email || "";
      let linkedin = p.linkedin_url || "";
      let title = p.title || "";
      let city = p.city || "";
      let country = p.country || "";
      const company = p.organization?.name || "";
      const industry = p.organization?.industry || "";
      const companySize = p.organization?.estimated_num_employees
        ? `${p.organization.estimated_num_employees} employees`
        : "";
      const companyWebsite = p.organization?.website_url || "";

      // Enrich by person ID to reveal email and full name (costs 1 credit)
      if (p.id && (!email || !lastName)) {
        try {
          const enrichRes = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
            body: JSON.stringify({ id: p.id, reveal_personal_emails: true }),
          });
          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            const ep = enrichData.person;
            if (ep) {
              firstName = ep.first_name || firstName;
              lastName = ep.last_name || lastName;
              email = ep.email || email;
              linkedin = ep.linkedin_url || linkedin;
              title = ep.title || title;
              city = ep.city || city;
              country = ep.country || country;
            }
            await trackApiUsage("apollo", "enrich_prospect", true);
          }
        } catch {
          // Continue without enrichment
        }
      }

      prospects.push({
        firstName,
        lastName,
        email,
        jobTitle: title,
        company,
        industry,
        city,
        country,
        companySize,
        companyWebsite,
        linkedinUrl: linkedin,
      });
    }

    return NextResponse.json({ prospects, total: people.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 }
    );
  }
}
