import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { I18nProvider } from "@/lib/i18n/context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://sienovo-intl.vercel.app";

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
    default: "Sienovo | Edge AI Computing Solutions for Industrial Video Analytics",
    template: "%s | Sienovo",
  },
  description:
    "Sienovo provides intelligent edge AI computing solutions for industrial video analytics. Featuring INT-AIBOX series with up to 12 TOPS AI power, 8/16-channel HD video, 40+ built-in algorithms for smart monitoring, safety, and automation.",
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
      zh: "/?lang=zh",
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
                email: "leo.liu@jytech.us",
                contactType: "sales",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: "INT-AIBOX-P-8",
              description:
                "High-performance edge AI computing device with 7.2 TOPS INT8 AI power, 8-channel HD video, 40+ built-in AI algorithms.",
              brand: { "@type": "Brand", name: "Sienovo" },
              category: "Edge AI Computing",
              offers: {
                "@type": "Offer",
                availability: "https://schema.org/InStock",
                priceCurrency: "USD",
              },
            }),
          }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S6MJ5ZRH0E"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-S6MJ5ZRH0E');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
