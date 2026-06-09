import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { I18nProvider } from "@/lib/i18n/context";
import { SITE_URL } from "@/lib/site";
import SupportChat from "@/components/SupportChat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = SITE_URL;
const axonEventKey = process.env.AXON_EVENT_KEY;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sienovo | Edge AI Computing for Industrial Video Analytics",
    template: "%s | Sienovo",
  },
  description:
    "Edge AI computing for industrial video analytics. INT-AIBOX series with up to 12 TOPS, 8/16-channel HD video, and 40+ built-in AI algorithms ready to deploy.",
  keywords: [
    "edge AI",
    "video analytics",
    "AI computing box",
    "industrial AI",
    "smart monitoring",
    "INT-AIBOX",
    "Sienovo",
    "edge computing",
    "AI algorithms",
    "computer vision",
    "边缘AI",
    "视频分析",
    "智能监控",
  ],
  openGraph: {
    title: "Sienovo | Edge AI Computing Solutions",
    description:
      "Intelligent edge AI computing solutions for industrial video analytics. 40+ built-in AI algorithms, fanless design, industrial-grade reliability.",
    siteName: "Sienovo",
    type: "website",
    url: siteUrl,
    locale: "en_US",
    alternateLocale: "zh_CN",
    images: [
      {
        url: "/images/pptx/aibox-sg8.png",
        width: 1200,
        height: 630,
        alt: "INT-AIBOX-P-8 Edge AI Computing Box",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sienovo | Edge AI Computing Solutions",
    description:
      "Intelligent edge AI computing solutions for industrial video analytics. 40+ built-in AI algorithms.",
    images: ["/images/pptx/aibox-sg8.png"],
  },
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      "x-default": "/",
      zh: "/zh",
    },
    types: {
      "application/rss+xml": [
        { url: "/rss.xml", title: "Sienovo · Edge AI Insights (EN)" },
        { url: "/zh/rss.xml", title: "Sienovo · 边缘 AI 洞察（中文）" },
      ],
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "dCOzcJuYEo7p2D0DMwvs9sqE4w5rosYDwLziJNaT9oI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Sienovo Blog"
          href="/blog/rss.xml"
        />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Sienovo",
              url: siteUrl,
              logo: `${siteUrl}/images/pptx/aibox-sg8.png`,
              description:
                "Intelligent edge AI computing solutions for industrial video analytics.",
              address: {
                "@type": "PostalAddress",
                streetAddress: "600 California St",
                addressLocality: "San Francisco",
                addressRegion: "CA",
                postalCode: "94108",
                addressCountry: "US",
              },
              contactPoint: {
                "@type": "ContactPoint",
                email: "collin.liu@sienovo.cn",
                contactType: "sales",
              },
            }),
          }}
        />
        {/* Product schema removed from root layout: it injected into every page
            including blog articles, where Google flagged it for missing required
            fields (`offers` / `aggregateRating` / `review`). Product structured
            data now belongs only on the product detail page itself. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S6MJ5ZRH0E"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-S6MJ5ZRH0E');
            // Google Ads conversion tracking — feeds the MAXIMIZE_CONVERSIONS
            // PMax campaign so it has data to optimize against.
            gtag('config', 'AW-1003516092');
            gtag('event', 'conversion', {
              send_to: 'AW-1003516092/AkvcCLu2tK0cELzhwd4D',
              value: 1.0,
              currency: 'USD',
            });
          `}
        </Script>
        {axonEventKey && (
          <Script id="axon-pixel" strategy="lazyOnload">
            {`
              var AXON_EVENT_KEY=${JSON.stringify(axonEventKey)};
              !function(e,r){var t=["https://s.axon.ai/pixel.js","https://res4.applovin.com/p/l/loader.iife.js"];if(!e.axon){var a=e.axon=function(){a.performOperation?a.performOperation.apply(a,arguments):a.operationQueue.push(arguments)};a.operationQueue=[],a.ts=Date.now(),a.eventKey=AXON_EVENT_KEY;for(var n=r.getElementsByTagName("script")[0],o=0;o<t.length;o++){var i=r.createElement("script");i.async=!0,i.src=t[o],n.parentNode.insertBefore(i,n)}}}(window,document);
              axon("init");
              axon("track","page_view");
            `}
          </Script>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
        <SupportChat />
        <Analytics />
      </body>
    </html>
  );
}
