/**
 * Single source of truth for press-page media. Both `/press` (EN) and
 * `/zh/press` import from here so the asset list stays in sync — only
 * the human-facing copy diverges per locale.
 *
 * To add a press release: append to PRESS_RELEASES; the page sections render
 * conditionally so an empty list stays hidden.
 */

export type BrandDownload = {
  href: string;
  title: string;
  alt: string;
  dimensions: string;
};

export type PressImage = {
  src: string;
  alt: string;
  title: string;
  caption: string;
  /** When set, the card links to /products/{slug} instead of opening the
   *  raw image — readers get the full product page (specs, gallery, CTA). */
  productSlug?: string;
};

export type PressVideo = {
  src: string;
  poster?: string;
  title: string;
  description: string;
  /** ISO 8601 date — required by schema.org/VideoObject for indexing. */
  uploadDate: string;
};

export const BRAND_ASSETS = {
  logoLandscape: {
    href: "/ads/logo-landscape-1774x887.png",
    title: "Sienovo logo — landscape",
    alt: "Sienovo wordmark logo, horizontal layout",
    dimensions: "1774×887",
  } satisfies BrandDownload,
  logoSquare: {
    href: "/ads/logo-square-1200.png",
    title: "Sienovo logo — square",
    alt: "Sienovo wordmark logo, square layout",
    dimensions: "1200×1200",
  } satisfies BrandDownload,
  /** Used by JSON-LD `image` array; safe defaults for OG/Twitter card preview. */
  previews: [
    { href: "/images/pptx/aibox-sg8.png" },
    { href: "/images/pptx/aibox-sg16.png" },
    { href: "/images/pptx/aibox-lineup.png" },
  ],
} as const;

export const PRODUCT_IMAGES: PressImage[] = [
  {
    src: "/images/pptx/aibox-sg8.png",
    alt: "INT-AIBOX-P-8 edge AI computing box, front view",
    title: "INT-AIBOX-P-8",
    caption: "8-channel edge AI device · 7.2 TOPS",
    productSlug: "int-aibox-p-8",
  },
  {
    src: "/images/pptx/aibox-sg16.png",
    alt: "INT-AIBOX 16-channel edge AI computing box, front view",
    title: "INT-AIBOX (16-channel)",
    caption: "Higher-tier edge AI device · 12 TOPS",
  },
  {
    src: "/images/pptx/aibox-lineup.png",
    alt: "Sienovo INT-AIBOX product lineup",
    title: "INT-AIBOX lineup",
    caption: "Full product family",
  },
  {
    src: "/images/pptx/aibox-features.png",
    alt: "INT-AIBOX hardware features and interfaces",
    title: "Hardware features",
    caption: "Interface and capability overview",
  },
  {
    src: "/images/pptx/platform-overview.png",
    alt: "Sienovo management platform dashboard overview",
    title: "Management platform",
    caption: "Fleet operations and OTA dashboard",
  },
  {
    src: "/images/pptx/scene-construction.png",
    alt: "Smart construction site monitoring scenario",
    title: "Smart construction",
    caption: "Application scenario — construction safety",
  },
];

export const PRODUCT_VIDEOS: PressVideo[] = [
  {
    src: "/images/pptx/case-s31-image167.mp4",
    poster: "/images/pptx/case-s31-image166.png",
    title: "Restricted zone access control",
    description:
      "Real-time AI-driven access enforcement using Sienovo INT-AIBOX.",
    uploadDate: "2025-01-15",
  },
  {
    src: "/images/pptx/case-s32-image161.mp4",
    poster: "/images/pptx/case-s32-image163.png",
    title: "Perimeter intrusion detection",
    description: "Edge AI perimeter alerting deployed on industrial sites.",
    uploadDate: "2025-01-15",
  },
  {
    src: "/images/pptx/case-s33-image168.mp4",
    poster: "/images/pptx/case-s33-image169.png",
    title: "Worker PPE compliance",
    description:
      "Helmet and PPE detection running on-device at a construction site.",
    uploadDate: "2025-01-15",
  },
  {
    src: "/images/pptx/case-s34-image171.mp4",
    poster: "/images/pptx/case-s34-image170.png",
    title: "Smart gas station monitoring",
    description: "Smoking and phone-use detection for safety compliance.",
    uploadDate: "2025-01-15",
  },
];
