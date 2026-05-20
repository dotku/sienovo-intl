import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

export async function GET() {
  const siteUrl = SITE_URL;
  const posts = getAllPosts("en");

  const postList = posts
    .map((p) => `- [${p.title}](${siteUrl}/blog/${p.slug}) (${p.date})`)
    .join("\n");

  const content = `# Sienovo International

> Exclusive global distributor for intelligent edge AI computing solutions.

## About

Sienovo is a technology company based in San Francisco, CA, specializing in intelligent edge AI computing hardware and solutions. We are the exclusive global distributor for the INT-AIBOX-P-8, a high-performance, low-power edge AI analytics device powered by domestic TPU CV186AH.

## Products

- **INT-AIBOX-P-8**: Intelligent Edge AI Analytics Box
  - 7.2 TOPS INT8 computing power
  - 8-channel HD video analytics
  - 40+ built-in AI algorithms
  - Domestic TPU CV186AH processor
  - Applications: smart city, industrial inspection, traffic monitoring, perimeter security

## Key Pages

- [Home](${siteUrl}) — Product overview, features, specifications
- [Blog](${siteUrl}/blog) — Technical articles on embedded systems, edge AI, FPGA, ARM platforms
- [RSS Feed](${siteUrl}/blog/rss.xml)

## Technical Blog (${posts.length} articles)

Topics include: embedded systems, ARM+FPGA solutions, industrial computing, edge AI, CODESYS automation, VPX bus architectures, NI instrument replacements, medical devices, smart cameras, AGV controllers, and domestic chip alternatives.

${postList}

## Contact

- Email: collin.liu@sienovo.cn
- WhatsApp: +86 187 1868 8532
- Website: ${siteUrl}
- Address: 600 California St, San Francisco, CA 94108
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
