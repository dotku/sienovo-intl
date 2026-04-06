import { trackApiUsage } from "./api-usage";

const APOLLO_API_URL = "https://api.apollo.io/api/v1";
const GEMINI_MODEL = "gemini-2.5-flash";

// --- Snov.io Token Management ---

let snovAccessToken: string | null = null;
let snovTokenExpiry = 0;

async function getSnovToken(): Promise<string | null> {
  if (snovAccessToken && Date.now() < snovTokenExpiry) return snovAccessToken;

  const clientId = process.env.SNOV_API_ID;
  const clientSecret = process.env.SNOV_API_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    snovAccessToken = data.access_token;
    snovTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return snovAccessToken;
  } catch {
    return null;
  }
}

// --- Company Enrichment ---

export interface CompanyEnrichment {
  name?: string;
  website?: string;
  industry?: string;
  size?: string;
  linkedinUrl?: string;
  phone?: string;
  city?: string;
  country?: string;
  description?: string;
}

export async function enrichCompany(
  query: { name?: string; website?: string } | string
): Promise<CompanyEnrichment | null> {
  const apolloResult = await enrichCompanyWithApollo(query);
  if (apolloResult) { await trackApiUsage("apollo", "enrich_company", true); return apolloResult; }

  const snovResult = await enrichCompanyWithSnov(query);
  if (snovResult) { await trackApiUsage("snov", "enrich_company", true); return snovResult; }

  const geminiResult = await enrichCompanyWithGemini(query);
  if (geminiResult) { await trackApiUsage("gemini", "enrich_company", true); return geminiResult; }

  return null;
}

async function enrichCompanyWithApollo(
  query: { name?: string; website?: string } | string
): Promise<CompanyEnrichment | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  const q = typeof query === "string" ? { name: query } : query;
  if (!q.name && !q.website) return null;

  try {
    const params: Record<string, string> = {};
    if (q.website) params.domain = q.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (q.name) params.name = q.name;

    const res = await fetch(`${APOLLO_API_URL}/organizations/enrich`, {
      method: "GET",
      headers: { "X-Api-Key": apiKey },
    });

    // Apollo org enrich uses query params
    const searchParams = new URLSearchParams(params);
    const enrichRes = await fetch(`${APOLLO_API_URL}/organizations/enrich?${searchParams}`, {
      headers: { "X-Api-Key": apiKey },
    });
    void res;

    if (!enrichRes.ok) return null;

    const data = await enrichRes.json();
    const org = data.organization;
    if (!org) return null;

    return {
      name: org.name,
      website: org.website_url,
      industry: org.industry,
      size: org.estimated_num_employees
        ? `${org.estimated_num_employees} employees`
        : undefined,
      linkedinUrl: org.linkedin_url,
      phone: org.phone,
      city: org.city,
      country: org.country,
      description: org.short_description,
    };
  } catch {
    return null;
  }
}

async function enrichCompanyWithSnov(
  query: { name?: string; website?: string } | string
): Promise<CompanyEnrichment | null> {
  const token = await getSnovToken();
  if (!token) return null;

  const q = typeof query === "string" ? { name: query } : query;
  const domain = q.website
    ? q.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : q.name
      ? q.name.toLowerCase().replace(/\s+/g, "") + ".com"
      : null;

  if (!domain) return null;

  try {
    const res = await fetch("https://api.snov.io/v1/get-domain-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        domain,
        type: "personal",
        limit: 1,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success) return null;

    const result: CompanyEnrichment = {};
    if (data.companyName) result.name = data.companyName;
    if (data.domain) result.website = data.domain;

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

async function enrichCompanyWithGemini(
  query: { name?: string; website?: string } | string
): Promise<CompanyEnrichment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const q = typeof query === "string" ? { name: query } : query;
  const parts: string[] = [];
  if (q.name) parts.push(`Company name: ${q.name}`);
  if (q.website) parts.push(`Website: ${q.website}`);

  if (parts.length === 0) return null;

  const prompt = `You are a business research assistant. Given the following information about a company, find their details using publicly available information.

${parts.join("\n")}

Return ONLY a JSON object with the following fields (use null for unknown fields):
{
  "name": string or null,
  "website": string or null,
  "industry": string or null,
  "size": string or null (e.g. "500-1000 employees"),
  "linkedinUrl": string or null (company LinkedIn page),
  "phone": string or null,
  "city": string or null (headquarters city),
  "country": string or null (headquarters country),
  "description": string or null (1-2 sentence description)
}

Only include information you are confident about from public sources. Do not fabricate data.
Return ONLY the JSON object, no other text.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const result: CompanyEnrichment = {};
    if (parsed.name) result.name = parsed.name;
    if (parsed.website) result.website = parsed.website;
    if (parsed.industry) result.industry = parsed.industry;
    if (parsed.size) result.size = parsed.size;
    if (parsed.linkedinUrl) result.linkedinUrl = parsed.linkedinUrl;
    if (parsed.phone) result.phone = parsed.phone;
    if (parsed.city) result.city = parsed.city;
    if (parsed.country) result.country = parsed.country;
    if (parsed.description) result.description = parsed.description;

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

// --- Contact Enrichment ---

export interface ApolloEnrichment {
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  industry?: string;
  linkedinUrl?: string;
  city?: string;
  country?: string;
  companySize?: string;
  companyWebsite?: string;
}

export async function enrichContact(
  query: {
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  } | string
): Promise<ApolloEnrichment | null> {
  // Try Apollo first, then Snov.io, then fall back to Gemini
  const apolloResult = await enrichWithApollo(query);
  if (apolloResult) { await trackApiUsage("apollo", "enrich_contact", true); return apolloResult; }

  const snovResult = await enrichWithSnov(query);
  if (snovResult) { await trackApiUsage("snov", "enrich_contact", true); return snovResult; }

  const geminiResult = await enrichWithGemini(query);
  if (geminiResult) { await trackApiUsage("gemini", "enrich_contact", true); return geminiResult; }

  return null;
}

async function enrichWithApollo(
  query: {
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  } | string
): Promise<ApolloEnrichment | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  const params = typeof query === "string"
    ? { email: query }
    : {
        ...(query.email && { email: query.email }),
        ...(query.firstName && { first_name: query.firstName }),
        ...(query.lastName && { last_name: query.lastName }),
        ...(query.company && { organization_name: query.company }),
      };

  if (Object.keys(params).length === 0) return null;

  try {
    const res = await fetch(`${APOLLO_API_URL}/people/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const person = data.person;
    if (!person) return null;

    return {
      firstName: person.first_name,
      lastName: person.last_name,
      title: person.title,
      company: person.organization?.name,
      industry: person.organization?.industry,
      linkedinUrl: person.linkedin_url,
      city: person.city,
      country: person.country,
      companySize: person.organization?.estimated_num_employees
        ? `${person.organization.estimated_num_employees} employees`
        : undefined,
      companyWebsite: person.organization?.website_url,
    };
  } catch {
    return null;
  }
}

async function enrichWithSnov(
  query: {
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  } | string
): Promise<ApolloEnrichment | null> {
  const token = await getSnovToken();
  if (!token) return null;

  const q = typeof query === "string" ? { email: query } : query;

  // Strategy 1: If we have an email, get prospect profile
  if (q.email) {
    try {
      const res = await fetch("https://api.snov.io/v1/get-profile-by-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token, email: q.email }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const d = data.data;
          const result: ApolloEnrichment = {};
          if (d.firstName) result.firstName = d.firstName;
          if (d.lastName) result.lastName = d.lastName;
          if (d.currentJob?.[0]?.companyName) result.company = d.currentJob[0].companyName;
          if (d.currentJob?.[0]?.position) result.title = d.currentJob[0].position;
          if (d.currentJob?.[0]?.industry) result.industry = d.currentJob[0].industry;
          if (d.social?.length) {
            const linkedin = d.social.find((s: { type: string; link: string }) => s.type === "linkedin");
            if (linkedin) result.linkedinUrl = linkedin.link;
          }
          if (d.country) result.country = d.country;
          if (d.city) result.city = d.city;
          if (Object.keys(result).length > 0) return result;
        }
      }
    } catch {
      // Fall through
    }
  }

  // Strategy 2: If we have name + company domain, find email
  if (q.firstName && q.lastName && q.company) {
    try {
      // First get domain from company name
      const domainRes = await fetch("https://api.snov.io/v1/get-domain-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: token,
          domain: q.company.toLowerCase().replace(/\s+/g, "") + ".com",
          type: "personal",
          limit: 1,
        }),
      });

      if (domainRes.ok) {
        const domainData = await domainRes.json();
        const companyName = domainData.companyName;
        const domain = domainData.domain;

        // Find email by name
        const emailRes = await fetch("https://api.snov.io/v1/add-names-to-find-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: token,
            firstName: q.firstName,
            lastName: q.lastName,
            domain: domain || q.company.toLowerCase().replace(/\s+/g, "") + ".com",
          }),
        });

        if (emailRes.ok) {
          const emailData = await emailRes.json();
          if (emailData.data?.emails?.length) {
            return {
              firstName: q.firstName,
              lastName: q.lastName,
              company: companyName || q.company,
            };
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

// --- Gemini ---

async function enrichWithGemini(
  query: {
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  } | string
): Promise<ApolloEnrichment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const q = typeof query === "string" ? { email: query } : query;
  const parts: string[] = [];
  if (q.firstName) parts.push(`First name: ${q.firstName}`);
  if (q.lastName) parts.push(`Last name: ${q.lastName}`);
  if (q.email) parts.push(`Email: ${q.email}`);
  if (q.company) parts.push(`Company: ${q.company}`);

  if (parts.length === 0) return null;

  const prompt = `You are a business contact research assistant. Given the following information about a person, find their professional details using publicly available information.

${parts.join("\n")}

Return ONLY a JSON object with the following fields (use null for unknown fields):
{
  "firstName": string or null,
  "lastName": string or null,
  "title": string or null (their job title),
  "company": string or null,
  "industry": string or null,
  "linkedinUrl": string or null,
  "city": string or null,
  "country": string or null,
  "companySize": string or null (e.g. "10000+ employees"),
  "companyWebsite": string or null
}

Only include information you are confident about from public sources. Do not fabricate data.
Return ONLY the JSON object, no other text.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Only return fields that have values
    const result: ApolloEnrichment = {};
    if (parsed.firstName) result.firstName = parsed.firstName;
    if (parsed.lastName) result.lastName = parsed.lastName;
    if (parsed.title) result.title = parsed.title;
    if (parsed.company) result.company = parsed.company;
    if (parsed.industry) result.industry = parsed.industry;
    if (parsed.linkedinUrl) result.linkedinUrl = parsed.linkedinUrl;
    if (parsed.city) result.city = parsed.city;
    if (parsed.country) result.country = parsed.country;
    if (parsed.companySize) result.companySize = parsed.companySize;
    if (parsed.companyWebsite) result.companyWebsite = parsed.companyWebsite;

    // Only return if we got at least some useful data
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
