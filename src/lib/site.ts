/**
 * Single source of truth for the canonical site URL.
 *
 * The production domain is `https://intl.sienovo.cn`. The previous
 * domain (`sienovo.jytech.us`) now 301-redirects here, which is why
 * canonical, OG, sitemap, JSON-LD, and Ads asset destinations all
 * needed to migrate — Google Ads flagged "Destination mismatch"
 * policy violation when ads pointed at jytech.us but landed on
 * intl.sienovo.cn. Reads from `NEXT_PUBLIC_SITE_URL` so previews can
 * override.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://intl.sienovo.cn";

export const SITE_NAME = "Sienovo";
