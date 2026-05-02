/**
 * Single source of truth for the canonical site URL.
 *
 * The production domain is `https://sienovo.jytech.us`. Reads from
 * `NEXT_PUBLIC_SITE_URL` so previews can override; falls back to the
 * production value so a missing env var never points the canonical /
 * sitemap / RSS / OG tags at a stale or wrong host.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://sienovo.jytech.us";

export const SITE_NAME = "Sienovo";
