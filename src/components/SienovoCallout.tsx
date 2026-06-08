import type { BlogLocale } from "@/lib/blog";

/**
 * Branded footer rendered under every blog article. Most of the synced archive
 * is third-party programming content; this ties each page back to Sienovo —
 * adding brand context and internal links to the product and contact pages so
 * link equity and topical relevance flow to what actually matters for SEO.
 */
export default function SienovoCallout({ locale }: { locale: BlogLocale }) {
  const homeHref = "/";
  const contactHref = locale === "zh" ? "/zh/contact" : "/contact";

  const t =
    locale === "zh"
      ? {
          label: "关于 Sienovo · 深圳信迈",
          body: "本文由 Sienovo(深圳信迈)分享。我们是一家边缘 AI 计算公司,自研 INT-AIBOX 系列工业级 AI 计算盒——最高 12 TOPS 算力、8–16 路高清视频接入、40+ 预置 AI 算法,广泛应用于智慧社区、加油站、工地、园区与环境监测。",
          products: "了解 INT-AIBOX 产品",
          contact: "联系我们",
        }
      : {
          label: "About Sienovo (深圳信迈)",
          body: "This article is shared by Sienovo (Shenzhen Sienovo), an edge AI computing company. We build the INT-AIBOX series — fanless, industrial-grade AI boxes with up to 12 TOPS of compute, 8–16 HD video channels, and 40+ pre-loaded AI algorithms for smart communities, gas stations, construction sites, parks, and environmental monitoring.",
          products: "Explore INT-AIBOX products",
          contact: "Contact us",
        };

  return (
    <aside className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6 not-prose">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t.label}</p>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{t.body}</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
        <a href={homeHref} className="text-accent hover:underline">
          {t.products} →
        </a>
        <a href={contactHref} className="text-accent hover:underline">
          {t.contact} →
        </a>
      </div>
    </aside>
  );
}
