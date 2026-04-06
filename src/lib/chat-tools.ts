import { enrichContact, enrichCompany } from "./apollo";
import { prisma } from "./prisma";
import { trackApiUsage } from "./api-usage";
import { searchSocialPlatform, type Platform, type SearchType } from "./social-search";

export interface ToolResult {
  tool: string;
  result: string;
}

export async function executeTool(
  name: string,
  args: Record<string, string>
): Promise<string> {
  switch (name) {
    case "enrich_contact": {
      const data = await enrichContact({
        email: args.email || undefined,
        firstName: args.firstName || undefined,
        lastName: args.lastName || undefined,
        company: args.company || undefined,
      });
      if (!data) return "❌ 未找到该联系人的补充信息";
      return `✅ 联系人信息补全:\n${Object.entries(data)
        .filter(([, v]) => v)
        .map(([k, v]) => `- **${k}**: ${v}`)
        .join("\n")}`;
    }

    case "enrich_company": {
      const data = await enrichCompany({
        name: args.name || undefined,
        website: args.website || undefined,
      });
      if (!data) return "❌ 未找到该公司的补充信息";
      return `✅ 公司信息补全:\n${Object.entries(data)
        .filter(([, v]) => v)
        .map(([k, v]) => `- **${k}**: ${v}`)
        .join("\n")}`;
    }

    case "search_contacts": {
      const where: Record<string, unknown> = {};
      if (args.company) where.company = { contains: args.company, mode: "insensitive" };
      if (args.industry) where.industry = { contains: args.industry, mode: "insensitive" };
      if (args.country) where.country = { contains: args.country, mode: "insensitive" };
      if (args.isLead === "true") where.isLead = true;

      const contacts = await prisma.contact.findMany({
        where,
        take: 20,
        orderBy: { updatedAt: "desc" },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          company: true,
          jobTitle: true,
          industry: true,
          country: true,
          isLead: true,
        },
      });

      if (contacts.length === 0) return "📭 CRM 中未找到匹配的联系人";
      return `Found ${contacts.length} contacts:\n${contacts
        .map((c) => {
          const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
          return `- ${name} | ${c.email} | ${c.jobTitle || "—"} @ ${c.company || "—"} | ${c.country || "—"}${c.isLead ? " [LEAD]" : ""}`;
        })
        .join("\n")}`;
    }

    case "search_companies": {
      const where: Record<string, unknown> = {};
      if (args.industry) where.industry = { contains: args.industry, mode: "insensitive" };
      if (args.country) where.country = { contains: args.country, mode: "insensitive" };
      if (args.name) where.name = { contains: args.name, mode: "insensitive" };

      const companies = await prisma.company.findMany({
        where,
        take: 20,
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { contacts: true } } },
      });

      if (companies.length === 0) return "📭 CRM 中未找到匹配的公司";
      return `Found ${companies.length} companies:\n${companies
        .map(
          (c) =>
            `- ${c.name} | ${c.industry || "—"} | ${c.country || "—"} | ${c.website || "—"} | ${c._count.contacts} contacts`
        )
        .join("\n")}`;
    }

    case "search_people_at_company": {
      const domain = args.domain || args.website;
      const companyName = args.company;
      const titles = args.titles; // comma-separated
      if (!domain && !companyName) return "Error: company domain or name is required.";

      const apiKey = process.env.APOLLO_API_KEY;
      if (!apiKey) return "Apollo API key not configured.";

      try {
        const body: Record<string, unknown> = { per_page: 10 };
        if (domain) body.q_organization_domains = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        else if (companyName) body.q_organization_name = companyName;
        if (titles) body.person_titles = titles.split(",").map((t: string) => t.trim());

        const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
          body: JSON.stringify(body),
        });
        if (!res.ok) return `Apollo search failed: ${res.status}`;

        const data = await res.json();
        const people = data.people || [];
        if (people.length === 0) return "📭 未在该公司找到相关人员";

        // Enrich each person by ID to reveal full name + email
        const results: string[] = [];
        for (const p of people.slice(0, 8)) {
          let firstName = p.first_name || "";
          let lastName = p.last_name || "";
          let email = p.email || "";
          let linkedin = p.linkedin_url || "";
          let title = p.title || "";
          let city = p.city || "";
          let country = p.country || "";

          if (p.id && (!email || !lastName)) {
            try {
              const enrichRes = await fetch("https://api.apollo.io/api/v1/people/match", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
                body: JSON.stringify({ id: p.id, reveal_personal_emails: true }),
              });
              if (enrichRes.ok) {
                const ed = await enrichRes.json();
                const ep = ed.person;
                if (ep) {
                  firstName = ep.first_name || firstName;
                  lastName = ep.last_name || lastName;
                  email = ep.email || email;
                  linkedin = ep.linkedin_url || linkedin;
                  title = ep.title || title;
                  city = ep.city || city;
                  country = ep.country || country;
                }
              }
              await trackApiUsage("apollo", "enrich_prospect", true);
            } catch {}
          }

          results.push(
            `- **${firstName} ${lastName}** | ${title || "N/A"} | ${email || "N/A"} | ${linkedin || "N/A"} | ${city ? `${city}, ${country}` : country || "N/A"}`
          );
        }

        return `Found ${people.length} people at ${companyName || domain}:\n\n| Name | Title | Email | LinkedIn | Location |\n|------|-------|-------|----------|----------|\n${results.join("\n")}`;
      } catch (e) {
        return `Search failed: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    case "recommend_prospects": {
      const industry = args.industry || "";
      const count = parseInt(args.count || "10") || 10;

      // Gather business context
      const products = await prisma.product.findMany({
        where: { active: true },
        select: { name: true, description: true },
      });
      const existingCompanies = await prisma.company.findMany({
        select: { name: true, website: true, industry: true },
        take: 20,
      });
      const contactCompanies = await prisma.contact.findMany({
        where: { company: { not: null } },
        select: { company: true, companyWebsite: true, industry: true },
        distinct: ["company"],
        take: 30,
      });

      const productInfo = products.map((p) => `${p.name}: ${p.description}`).join("\n");
      const existingNames = [
        ...existingCompanies.map((c) => c.name),
        ...contactCompanies.map((c) => c.company).filter(Boolean),
      ];
      const existingList = existingNames.join(", ");

      const prompt = `You are a B2B sales strategist. Our products:\n${productInfo}\n\nExisting clients (avoid these): ${existingList}\n\n${industry ? `Focus on: ${industry}\n` : ""}Recommend ${count} specific companies that would be ideal prospects for edge AI video analytics products. Include companies needing quality control, warehouse safety, or factory automation.\n\nFor each, return: name, domain, industry, reason (10 words max), and 2-3 suggested job titles to contact.\n\nReturn ONLY JSON:\n[{"name":"...","domain":"...","industry":"...","reason":"...","titles":["VP Operations","Quality Manager"]}]`;

      const cerebrasKey = process.env.CEREBRAS_API_KEY;
      if (!cerebrasKey) return "AI not configured.";

      try {
        const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${cerebrasKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "qwen-3-235b-a22b-instruct-2507",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }),
        });
        if (!res.ok) return "AI recommendation failed.";

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) return "Failed to parse recommendations.";

        const recs = JSON.parse(match[0]) as { name: string; domain: string; industry: string; reason: string; titles: string[] }[];
        await trackApiUsage("cerebras", "recommend_prospects", true);

        // Now use Apollo to find contacts at the top recommended companies
        const apolloKey = process.env.APOLLO_API_KEY;
        const lines: string[] = [`## 推荐 ${recs.length} 家目标公司\n`];

        for (const rec of recs.slice(0, count)) {
          lines.push(`### ${rec.name} (${rec.domain})`);
          lines.push(`- 行业: ${rec.industry} | 理由: ${rec.reason}`);

          if (apolloKey) {
            try {
              const searchRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Api-Key": apolloKey },
                body: JSON.stringify({
                  per_page: 3,
                  q_organization_domains: rec.domain,
                  person_titles: rec.titles,
                }),
              });
              if (searchRes.ok) {
                const searchData = await searchRes.json();
                const people = searchData.people || [];

                if (people.length > 0) {
                  lines.push("- 关键联系人:");
                  for (const p of people.slice(0, 3)) {
                    let firstName = p.first_name || "";
                    let lastName = p.last_name || "";
                    let email = p.email || "";

                    if (p.id && (!email || !lastName)) {
                      try {
                        const enrichRes = await fetch("https://api.apollo.io/api/v1/people/match", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "X-Api-Key": apolloKey },
                          body: JSON.stringify({ id: p.id, reveal_personal_emails: true }),
                        });
                        if (enrichRes.ok) {
                          const ed = await enrichRes.json();
                          if (ed.person) {
                            firstName = ed.person.first_name || firstName;
                            lastName = ed.person.last_name || lastName;
                            email = ed.person.email || email;
                          }
                        }
                      } catch {}
                    }

                    lines.push(`  - **${firstName} ${lastName}** | ${p.title || "N/A"} | 📧 ${email || "未找到邮箱"}`);
                  }
                } else {
                  lines.push("- ⚠️ 未找到匹配联系人，建议搜索职位: " + rec.titles.join(", "));
                }
              }
            } catch {}
          } else {
            lines.push(`- 建议搜索职位: ${rec.titles.join(", ")}`);
          }
          lines.push("");
        }

        return lines.join("\n");
      } catch (e) {
        return `Recommendation failed: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    case "add_contact": {
      if (!args.email) return "Error: email is required to add a contact.";
      const contact = await prisma.contact.upsert({
        where: { email: args.email },
        update: {
          ...(args.firstName && { firstName: args.firstName }),
          ...(args.lastName && { lastName: args.lastName }),
          ...(args.company && { company: args.company }),
          ...(args.jobTitle && { jobTitle: args.jobTitle }),
          ...(args.industry && { industry: args.industry }),
          ...(args.country && { country: args.country }),
          ...(args.city && { city: args.city }),
          ...(args.linkedinUrl && { linkedinUrl: args.linkedinUrl }),
          isLead: args.isLead === "true",
        },
        create: {
          email: args.email,
          firstName: args.firstName || null,
          lastName: args.lastName || null,
          company: args.company || null,
          jobTitle: args.jobTitle || null,
          industry: args.industry || null,
          country: args.country || null,
          city: args.city || null,
          linkedinUrl: args.linkedinUrl || null,
          isLead: args.isLead === "true",
          source: "ai_chat",
        },
      });
      return `✅ 已添加联系人: ${contact.firstName || ""} ${contact.lastName || ""} <${contact.email}>${contact.isLead ? " [潜在客户]" : ""}`;
    }

    case "web_search": {
      const query = args.query;
      if (!query) return "Error: search query is required.";

      // Try Serper first (fast, structured Google results)
      const serperKey = process.env.SERPER_API_KEY;
      if (serperKey) {
        try {
          const res = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "X-API-KEY": serperKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, num: 10 }),
          });
          if (res.ok) {
            const data = await res.json();
            const results: string[] = [];

            if (data.knowledgeGraph) {
              const kg = data.knowledgeGraph;
              results.push(`**${kg.title}** ${kg.type ? `(${kg.type})` : ""}\n${kg.description || ""}\n${kg.website ? `Website: ${kg.website}` : ""}`);
            }

            if (data.organic?.length) {
              for (const item of data.organic.slice(0, 8)) {
                results.push(`- **${item.title}**\n  ${item.snippet || ""}\n  URL: ${item.link}`);
              }
            }

            if (results.length > 0) {
              trackApiUsage("serper", "web_search", true);
              return `Web search results for "${query}":\n\n${results.join("\n\n")}`;
            }
          }
        } catch {
          // Fall through to Gemini
        }
      }

      // Fallback: Gemini with Google Search grounding
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Search the web and provide a concise summary of results for: ${query}\n\nReturn company names, websites, brief descriptions, and locations. Focus on real, verifiable information.` }] }],
              tools: [{ googleSearch: {} }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
          }
        } catch {
          // Fall through
        }
      }

      return "Web search unavailable — no search API key configured.";
    }

    case "add_company": {
      if (!args.name) return "Error: company name is required.";
      const company = await prisma.company.upsert({
        where: { name: args.name },
        update: {
          ...(args.website && { website: args.website }),
          ...(args.industry && { industry: args.industry }),
          ...(args.country && { country: args.country }),
          ...(args.city && { city: args.city }),
          ...(args.size && { size: args.size }),
          ...(args.description && { description: args.description }),
        },
        create: {
          name: args.name,
          website: args.website || null,
          industry: args.industry || null,
          country: args.country || null,
          city: args.city || null,
          size: args.size || null,
          description: args.description || null,
        },
      });
      return `✅ 已添加公司: ${company.name}${company.website ? ` (${company.website})` : ""} [ID: ${company.id}]`;
    }

    case "search_social_leads": {
      const keywords = args.keywords || args.query;
      if (!keywords) return "Error: keywords is required.";

      const platform = (args.platform || "both") as Platform;
      const type = (args.type || "keyword") as SearchType;

      const results = await searchSocialPlatform(platform, keywords, type, 10);

      if (results.length === 0) return "📭 未找到相关结果，请尝试不同的关键词。";

      const platformLabel: Record<string, string> = { xiaohongshu: "小红书", weixin: "视频号", linkedin: "LinkedIn", youtube: "YouTube", reddit: "Reddit", twitter: "X", tiktok: "TikTok" };
      const typeLabel = { competitor: "竞品", buyer: "潜在买家", kol: "KOL/博主", keyword: "关键词" };
      const lines = [`## 📱 社交媒体搜索: "${keywords}" (${typeLabel[type]})\n`];

      for (const r of results) {
        const tag = r.source || platformLabel[r.platform] || r.platform;
        const author = r.author ? ` @${r.author}` : "";
        lines.push(`- [${r.title}](${r.url}) [${tag}${author}]`);
        if (r.snippet) lines.push(`  ${r.snippet}`);
        lines.push("");
      }

      lines.push(`共找到 ${results.length} 条结果。`);
      return lines.join("\n");
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export const TOOL_DESCRIPTIONS = `
You have access to the following tools. To use a tool, include a JSON block in your response wrapped in <tool> tags:

<tool>{"name": "tool_name", "args": {"key": "value"}}</tool>

Available tools:

1. **enrich_contact** — Look up a person using Apollo/Snov.io APIs to find their job title, company, LinkedIn, location, etc.
   Args: email, firstName, lastName, company (at least one required)
   Example: <tool>{"name": "enrich_contact", "args": {"email": "john@acme.com"}}</tool>

2. **enrich_company** — Look up a company using Apollo/Snov.io APIs to find industry, size, website, etc.
   Args: name, website (at least one required)
   Example: <tool>{"name": "enrich_company", "args": {"name": "Acme Corp"}}</tool>

3. **search_contacts** — Search the CRM database for contacts matching criteria.
   Args: company, industry, country, isLead ("true"/"false")
   Example: <tool>{"name": "search_contacts", "args": {"industry": "manufacturing", "country": "US"}}</tool>

4. **search_companies** — Search the CRM database for companies matching criteria.
   Args: name, industry, country
   Example: <tool>{"name": "search_companies", "args": {"industry": "energy"}}</tool>

5. **add_contact** — Add or update a contact in the CRM.
   Args: email (required), firstName, lastName, company, jobTitle, industry, country, city, linkedinUrl, isLead
   Example: <tool>{"name": "add_contact", "args": {"email": "jane@corp.com", "firstName": "Jane", "company": "Corp Inc", "isLead": "true"}}</tool>

6. **add_company** — Add or update a company in the CRM.
   Args: name (required), website, industry, country, city, size, description
   Example: <tool>{"name": "add_company", "args": {"name": "Corp Inc", "website": "corp.com", "industry": "Manufacturing"}}</tool>

7. **web_search** — Search the internet for real-time information about companies, industries, markets, etc.
   Args: query (required)
   Example: <tool>{"name": "web_search", "args": {"query": "industrial automation companies San Francisco"}}</tool>

8. **search_people_at_company** — Search for people at a specific company. Returns names, titles, emails, LinkedIn profiles.
   Args: domain OR company (required), titles (optional, comma-separated filter)
   Example: <tool>{"name": "search_people_at_company", "args": {"domain": "fictiv.com", "titles": "Engineering,Procurement,Operations"}}</tool>

9. **recommend_prospects** — AI-powered: analyzes our products and existing clients, then recommends new target companies with key contacts found via Apollo. Use this when the user asks to "推荐客户", "find new prospects", "recommend companies", etc.
   Args: industry (optional, focus area), count (optional, default 10)
   Example: <tool>{"name": "recommend_prospects", "args": {"industry": "manufacturing", "count": "5"}}</tool>

10. **search_social_leads** — Search social media platforms for potential clients, competitors, KOLs, or industry content. Supports: 小红书, 微信/视频号, LinkedIn, YouTube, Reddit, X (Twitter), TikTok.
   Args: keywords (required), platform ("xiaohongshu"/"weixin"/"linkedin"/"youtube"/"reddit"/"twitter"/"tiktok"/"all_cn"/"all_global"/"all", default "all"), type ("competitor"/"buyer"/"kol"/"keyword", default "keyword")
   Use "all_cn" for Chinese platforms, "all_global" for international, "all" for everything.
   Example: <tool>{"name": "search_social_leads", "args": {"keywords": "edge AI defect detection", "platform": "linkedin", "type": "competitor"}}</tool>
   Example: <tool>{"name": "search_social_leads", "args": {"keywords": "工业视觉检测", "platform": "all_cn", "type": "kol"}}</tool>

CRITICAL RULES FOR TOOL USAGE:
1. When the user asks to look up, enrich, search, or add contacts/companies — you MUST use the tools. Do NOT suggest commands for the user to run. YOU execute them directly.
2. Place <tool> tags directly in your response — NOT inside code blocks, NOT inside backticks. Write them as plain text: <tool>{"name":"...", "args":{...}}</tool>
3. The system will automatically execute the tools and feed results back to you. The user never sees the <tool> tags.
4. Do NOT fabricate contact data. If you don't have real data, use enrich_contact or enrich_company to look it up.
5. You may use multiple tools in one response.
6. NEVER wrap <tool> tags in backticks or code blocks. They must be bare text.

STRATEGY FOR FINDING NEW COMPANIES/CONTACTS:
- **recommend_prospects** is the BEST tool when the user wants to discover new potential clients. It automatically: (1) analyzes our products + existing clients, (2) recommends target companies, (3) finds contacts at each company with emails.
- search_contacts and search_companies ONLY search our internal CRM database.
- search_people_at_company finds people at a SPECIFIC company when you already know the domain.
- Typical manual prospecting workflow:
  1. web_search to find companies and key people
  2. enrich_company with name + website for structured data
  3. add_company to save to CRM
  4. search_people_at_company to find contacts with emails
  5. add_contact as lead
- NEVER use search_companies to find companies that might not be in our CRM. Use web_search or recommend_prospects instead.
- NEVER call "googleSearch" — that does not exist. Use "web_search" instead.
`;
