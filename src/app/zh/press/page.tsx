import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/site";
import {
  BRAND_ASSETS,
  PRODUCT_IMAGES,
  PRODUCT_VIDEOS,
} from "../../press/assets";

export const metadata: Metadata = {
  title: "媒体中心 · 品牌资源与媒体联系",
  description:
    "Sienovo（深圳信迈）媒体中心 —— 提供品牌资源下载、产品图片与视频、公司简介以及面向媒体的联系方式。",
  alternates: {
    canonical: "/zh/press",
    languages: {
      en: "/press",
      "x-default": "/press",
      zh: "/zh/press",
    },
  },
  openGraph: {
    title: "媒体中心 | Sienovo",
    description:
      "Sienovo（深圳信迈）面向记者与编辑的品牌资源、产品图片与媒体联系方式。",
    url: `${SITE_URL}/zh/press`,
    type: "website",
    locale: "zh_CN",
  },
};

const MEDIA_EMAIL = "leo.liu@jytech.us";
const YOUTUBE_CHANNEL = "https://www.youtube.com/@dk_wholesale";

const BOILERPLATE_PARAGRAPHS = [
  "Sienovo（深圳信迈）是一家专注于边缘 AI 计算的公司，为工业场景提供智能视频分析解决方案。INT-AIBOX 系列产品搭载最高 12 TOPS INT8 算力，支持 8 至 16 路高清视频接入，内置 40 多种 AI 算法，覆盖安全、安防与运营场景。",
  "Sienovo 设备采用工业级无风扇设计，配套自研管理平台，支持远程配置、车队级运维以及算法 OTA 升级。产品广泛部署于智慧社区、加油站、建筑工地、园区、零售与环保监测等行业，并已进入全球市场。",
];

const FAST_FACTS: Array<[string, string]> = [
  ["成立时间", "2014 年"],
  ["总部", "中国深圳"],
  ["全球办公室", "600 California St, San Francisco, CA 94108"],
  ["产品线", "INT-AIBOX 边缘 AI 计算盒子"],
  ["AI 算力", "7.2 – 12 TOPS INT8"],
  ["视频通道", "单机 8 – 16 路高清视频"],
  ["AI 算法", "40+ 内置算法，支持 OTA 更新"],
];

const IMAGE_COPY: Record<string, { title: string; caption: string }> = {
  "/images/pptx/aibox-sg8.png": {
    title: "INT-AIBOX-P-8",
    caption: "8 路边缘 AI 设备 · 7.2 TOPS",
  },
  "/images/pptx/aibox-sg16.png": {
    title: "INT-AIBOX-SG16",
    caption: "16 路边缘 AI 设备 · 12 TOPS",
  },
  "/images/pptx/aibox-lineup.png": {
    title: "INT-AIBOX 产品家族",
    caption: "完整产品阵容",
  },
  "/images/pptx/aibox-features.png": {
    title: "硬件特性",
    caption: "接口与核心能力概览",
  },
  "/images/pptx/platform-overview.png": {
    title: "管理平台",
    caption: "车队运维与 OTA 平台",
  },
  "/images/pptx/scene-construction.png": {
    title: "智慧工地",
    caption: "应用场景 —— 施工安全",
  },
};

const VIDEO_COPY: Record<string, { title: string; description: string }> = {
  "/images/pptx/case-s31-image167.mp4": {
    title: "重点区域出入管控",
    description: "基于 Sienovo INT-AIBOX 的实时 AI 出入管控。",
  },
  "/images/pptx/case-s32-image161.mp4": {
    title: "周界入侵检测",
    description: "工业现场部署的边缘 AI 周界告警。",
  },
  "/images/pptx/case-s33-image168.mp4": {
    title: "施工人员安全装备识别",
    description: "在工地端侧运行的安全帽与 PPE 识别。",
  },
  "/images/pptx/case-s34-image171.mp4": {
    title: "智慧加油站监测",
    description: "用于安全合规的吸烟与玩手机识别。",
  },
};

export default function PressPageZh() {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Sienovo",
    alternateName: ["深圳信迈", "Shenzhen Sienovo"],
    url: SITE_URL,
    logo: `${SITE_URL}${BRAND_ASSETS.logoSquare.href}`,
    image: BRAND_ASSETS.previews.map((p) => `${SITE_URL}${p.href}`),
    description:
      "工业视频分析领域的边缘 AI 计算厂商，INT-AIBOX 系列最高 12 TOPS、8/16 路高清视频、40+ 内置 AI 算法。",
    sameAs: [YOUTUBE_CHANNEL],
    address: {
      "@type": "PostalAddress",
      streetAddress: "600 California St",
      addressLocality: "San Francisco",
      addressRegion: "CA",
      postalCode: "94108",
      addressCountry: "US",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        email: MEDIA_EMAIL,
        contactType: "media inquiries",
        availableLanguage: ["en", "zh"],
      },
    ],
  };

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />

      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-accent uppercase mb-3">
              媒体中心
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-gray-900 max-w-3xl">
              面向媒体与记者的 Sienovo 资源包
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-2xl">
              品牌资源、产品图片与视频、公司简介与媒体联系方式。如需采访、产品解读或事实核查，请联系{" "}
              <a
                href={`mailto:${MEDIA_EMAIL}?subject=媒体咨询%20-%20Sienovo`}
                className="text-accent hover:underline"
              >
                {MEDIA_EMAIL}
              </a>
              。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#brand-assets"
                className="inline-flex items-center px-5 py-2.5 rounded bg-accent text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                下载品牌资源
              </a>
              <a
                href={`mailto:${MEDIA_EMAIL}?subject=媒体咨询%20-%20Sienovo`}
                className="inline-flex items-center px-5 py-2.5 rounded border border-gray-300 text-gray-800 text-sm font-semibold hover:border-accent hover:text-accent transition-colors"
              >
                联系媒体团队
              </a>
            </div>
          </div>
        </section>

        <section
          id="about"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
        >
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                关于 Sienovo
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                以下为官方公司简介，可在不改变技术表述的前提下直接引用或精简。
              </p>
              {BOILERPLATE_PARAGRAPHS.map((p, i) => (
                <p
                  key={i}
                  className="text-base text-gray-700 leading-relaxed mb-4"
                >
                  {p}
                </p>
              ))}
            </div>
            <aside className="lg:col-span-1">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm tracking-wide uppercase">
                  公司速览
                </h3>
                <dl className="space-y-3">
                  {FAST_FACTS.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-500">{k}</dt>
                      <dd className="text-sm text-gray-900 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>
        </section>

        <section
          id="brand-assets"
          className="bg-gray-50 border-y border-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              品牌资源
            </h2>
            <p className="text-base text-gray-600 mb-8 max-w-2xl">
              可直接下载用于报道。请勿对 Logo 进行裁切或调色。品牌主色为{" "}
              <code className="px-1.5 py-0.5 rounded bg-white text-accent text-sm">
                #dd3232
              </code>
              。
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                {
                  href: BRAND_ASSETS.logoLandscape.href,
                  title: "Sienovo 横向 Logo",
                  alt: "Sienovo 横向 Logo",
                  dimensions: BRAND_ASSETS.logoLandscape.dimensions,
                },
                {
                  href: BRAND_ASSETS.logoSquare.href,
                  title: "Sienovo 方形 Logo",
                  alt: "Sienovo 方形 Logo",
                  dimensions: BRAND_ASSETS.logoSquare.dimensions,
                },
              ].map((asset) => (
                <a
                  key={asset.href}
                  href={asset.href}
                  download
                  className="group block rounded-lg bg-white border border-gray-200 p-6 hover:border-accent transition-colors"
                >
                  <div className="h-32 flex items-center justify-center bg-white rounded mb-4 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.href}
                      alt={asset.alt}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {asset.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {asset.dimensions} · PNG · 点击下载
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section
          id="product-imagery"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            产品图片
          </h2>
          <p className="text-base text-gray-600 mb-8 max-w-2xl">
            高分辨率产品照片，可用于编辑使用。点击图片查看大图，或右键另存为。
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCT_IMAGES.map((img) => {
              const copy = IMAGE_COPY[img.src] ?? {
                title: img.title,
                caption: img.caption,
              };
              const linksToProduct = !!img.productSlug;
              const href = linksToProduct
                ? `/products/${img.productSlug}`
                : img.src;
              return (
                <a
                  key={img.src}
                  href={href}
                  {...(linksToProduct
                    ? {}
                    : { target: "_blank", rel: "noopener noreferrer" })}
                  className="group block rounded-lg overflow-hidden border border-gray-200 hover:border-accent transition-colors"
                >
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {copy.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {copy.caption}
                      </p>
                    </div>
                    {linksToProduct && (
                      <span className="text-xs font-semibold text-accent whitespace-nowrap shrink-0 mt-0.5">
                        查看产品 →
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section
          id="product-videos"
          className="bg-gray-50 border-y border-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              产品视频
            </h2>
            <p className="text-base text-gray-600 mb-8 max-w-2xl">
              INT-AIBOX 部署的真实场景短片，可在媒体网站嵌入使用（请注明 Sienovo
              来源）。更多长视频请访问{" "}
              <a
                href={YOUTUBE_CHANNEL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                官方 YouTube 频道
              </a>
              。
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {PRODUCT_VIDEOS.map((v) => {
                const copy = VIDEO_COPY[v.src] ?? {
                  title: v.title,
                  description: v.description,
                };
                return (
                  <figure
                    key={v.src}
                    className="rounded-lg overflow-hidden border border-gray-200 bg-white"
                  >
                    <video
                      controls
                      preload="metadata"
                      poster={v.poster}
                      className="w-full aspect-video bg-black"
                    >
                      <source src={v.src} type="video/mp4" />
                    </video>
                    <figcaption className="p-4">
                      <p className="font-medium text-gray-900 text-sm">
                        {copy.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {copy.description}
                      </p>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="media-contact"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
        >
          <div className="rounded-lg bg-gray-900 text-white p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              媒体联系方式
            </h2>
            <p className="text-base text-gray-300 max-w-2xl mb-6">
              如需采访邀约、产品深度解读、高管访谈或事实核查，欢迎邮件联系我们，我们通常会在一个工作日内回复。
            </p>
            <a
              href={`mailto:${MEDIA_EMAIL}?subject=媒体咨询%20-%20Sienovo`}
              className="inline-flex items-center px-5 py-2.5 rounded bg-accent text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              {MEDIA_EMAIL}
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
