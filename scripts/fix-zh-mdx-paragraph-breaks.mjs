#!/usr/bin/env node
/**
 * One-shot fix: CSDN-scraped MDX files have sentences broken across
 * paragraph boundaries because the source had PDF-style hard line
 * wraps that weren't unwrapped during ingestion.
 *
 * Example of the bug in the source file:
 *
 *   PCB 检查及电气特性测试，主
 *
 *   要用来验证硬件设计是否正常工作
 *
 * The blank line in Markdown creates two paragraphs — but "主要" is one
 * word. The article renders as a fragment ending in "主" then a new
 * paragraph starting with "要用来...", which is visually broken.
 *
 * Heuristic: a paragraph break is "spurious" if the previous paragraph
 * ends with one of:
 *   - a bare Chinese character (no punctuation)
 *   - a Chinese continuation punctuation (，、：；)
 * AND the next paragraph begins with a Chinese character.
 *
 * It is "real" if the previous paragraph ends with sentence-final
 * punctuation (。 ！ ？ ， ） 」 』 etc.) followed by a blank line.
 *
 * Usage:
 *   node scripts/fix-zh-mdx-paragraph-breaks.mjs              # dry-run summary
 *   node scripts/fix-zh-mdx-paragraph-breaks.mjs --write      # write fixes
 *   node scripts/fix-zh-mdx-paragraph-breaks.mjs --slug 1234  # preview one file
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const slugArg = args.indexOf("--slug");
const SLUG = slugArg !== -1 ? args[slugArg + 1] : null;

const BLOG_DIR = "content/blog";

// CJK Unified Ideographs block. Excludes punctuation so we can be
// precise about what counts as a "bare character".
const CJK = /[一-鿿]/;
// Continuation punctuation — line ending in these almost certainly
// means the next blank line is spurious, not a real paragraph break.
const CONT_PUNCT = /[，、：；]/;
// Sentence-final punctuation — if a paragraph ends with these, the
// blank line is a legitimate paragraph break, leave it.
// const END_PUNCT = /[。！？…]/; // not needed — we only join when prev ends in CJK char or CONT_PUNCT

// Lines that look like a section title — short, often starts with a
// digit-numeric prefix or 第X章/节 marker. Joining one of these onto the
// next paragraph turns "5.1 调试与验证仿真平台 / 为了对整个系统..." into
// one wall of text, which is worse than leaving the spurious break alone.
const TITLE_LINE =
  /(?:^|\n)[ \t]*((?:\d+(?:\.\d+)*[. 　]|第[一二三四五六七八九十百零\d]+(?:章|节|部分|条|步))[^\n]{0,30})\n[ \t]*\n/g;

function fixBody(body) {
  // Protect fenced code blocks from joining — split on ``` boundaries
  // and only transform the text segments.
  const parts = body.split(/(```[\s\S]*?```)/g);
  let breaksFixed = 0;
  const fixed = parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // odd parts are inside ``` fences
      return part.replace(
        // Group 1: a CJK char or continuation punct ending the prev line
        // Group 2: the blank-line gap (so we can inspect what comes before it)
        // Group 3: a CJK char starting the next paragraph
        /([一-鿿，、：；])([ \t]*\n[ \t]*\n+[ \t]*)([一-鿿])/g,
        (match, prev, _gap, next, offset, full) => {
          // Look back ~60 chars from the match position to find the
          // start of the previous "paragraph". If that paragraph looks
          // like a section title (short, starts with digit prefix or
          // 第X章 marker), preserve the break — don't merge.
          const startOfPara = full.lastIndexOf("\n", offset - 1) + 1;
          const prevPara = full.slice(startOfPara, offset + 1);
          const looksLikeTitle =
            prevPara.length <= 32 &&
            /^(?:\d+(?:\.\d+)*[. 　]|第[一二三四五六七八九十百零\d]+(?:章|节|部分|条|步))/.test(
              prevPara,
            );
          if (looksLikeTitle) return match;
          breaksFixed++;
          return prev + next;
        },
      );
    })
    .join("");
  // Marker is intentionally exported only via the regex's side effects above.
  void TITLE_LINE;
  return { fixed, breaksFixed };
}

function splitFrontmatter(raw) {
  const m = raw.match(/^(---\n[\s\S]*?\n---\n)/);
  if (!m) return { fm: "", body: raw };
  return { fm: m[1], body: raw.slice(m[1].length) };
}

const allFiles = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
const files = SLUG ? allFiles.filter((f) => f === `${SLUG}.mdx`) : allFiles;

if (files.length === 0) {
  console.error(`No MDX files matched.`);
  process.exit(1);
}

let totalChanged = 0;
let totalBreaks = 0;

for (const f of files) {
  const path = join(BLOG_DIR, f);
  const raw = readFileSync(path, "utf8");
  const { fm, body } = splitFrontmatter(raw);
  const { fixed, breaksFixed } = fixBody(body);

  if (breaksFixed === 0) continue;

  totalChanged++;
  totalBreaks += breaksFixed;

  if (SLUG || (!WRITE && totalChanged <= 3)) {
    // Show a preview of the first affected stretch
    const idx = body.search(
      /[一-鿿，、：；][ \t]*\n[ \t]*\n+[ \t]*[一-鿿]/,
    );
    if (idx !== -1) {
      console.log(`\n── ${f} — ${breaksFixed} break(s) ──`);
      console.log("BEFORE:");
      console.log(
        "  " +
          JSON.stringify(body.slice(Math.max(0, idx - 30), idx + 30)).slice(
            1,
            -1,
          ),
      );
      console.log("AFTER:");
      const fixedSnippet = fixed.slice(
        Math.max(0, idx - 30),
        idx + 30,
      );
      console.log("  " + JSON.stringify(fixedSnippet).slice(1, -1));
    }
  }

  if (WRITE) {
    writeFileSync(path, fm + fixed, "utf8");
  }
}

console.log(`\n--- Summary ---`);
console.log(`Files scanned:           ${files.length}`);
console.log(`Files with broken breaks: ${totalChanged}`);
console.log(`Total breaks ${WRITE ? "fixed" : "would fix"}:  ${totalBreaks}`);
if (!WRITE && totalChanged > 0) {
  console.log(`\nRun with --write to apply.`);
}
