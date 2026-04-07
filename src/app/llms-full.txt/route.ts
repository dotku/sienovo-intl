import { getAllPosts } from "@/lib/blog";

export async function GET() {
  const siteUrl = "https://sienovo-intl.vercel.app";
  const posts = getAllPosts();

  const postSections = posts
    .map(
      (p) => `## ${p.title}

- URL: ${siteUrl}/blog/${p.slug}
- Date: ${p.date}
- Tags: ${p.tags.join(", ") || "none"}

${p.content.substring(0, 1000)}

---`
    )
    .join("\n\n");

  const content = `# Sienovo International — Full Content

> Exclusive global distributor for intelligent edge AI computing solutions.
> Website: ${siteUrl}

## Company Overview

Sienovo is a technology company headquartered in San Francisco, CA. We specialize in intelligent edge AI computing hardware and industrial embedded solutions. As the exclusive global distributor for advanced edge AI devices, we serve industries including smart city infrastructure, industrial automation, transportation, and security.

### Core Product: INT-AIBOX-P-8

The INT-AIBOX-P-8 is an Intelligent Edge AI Analytics Box featuring:
- **Processor**: Domestic TPU CV186AH
- **AI Performance**: 7.2 TOPS INT8
- **Video Channels**: 8-channel HD video analytics
- **AI Algorithms**: 40+ built-in algorithms including object detection, face recognition, behavior analysis, vehicle analytics
- **Connectivity**: Ethernet, RS485, GPIO, USB, HDMI
- **Power**: Low-power design suitable for edge deployment
- **Use Cases**: Smart city, industrial inspection, traffic monitoring, perimeter security, retail analytics

### Application Scenarios
- Traffic management and vehicle analytics
- Factory floor monitoring and safety compliance
- Perimeter intrusion detection
- Retail footfall and behavior analysis
- Smart campus and building management
- Agricultural monitoring

## Contact Information

- Email: leo.liu@jytech.us
- WhatsApp: +86 187 1868 8532
- Demo: https://calendly.com/sienovo
- Address: 600 California St, San Francisco, CA 94108

---

# Blog Articles (${posts.length} total)

${postSections}
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
