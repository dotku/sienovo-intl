#!/usr/bin/env node
/**
 * Period-based business report generator.
 *
 * Usage:
 *   node scripts/gen-report.mjs --period daily   [--send] [--dry-run]
 *   node scripts/gen-report.mjs --period weekly  [--send] [--dry-run]   (Phase 2)
 *   node scripts/gen-report.mjs --period monthly [--send] [--dry-run]   (Phase 3)
 *
 * Env it expects:
 *   GH_TOKEN        — for `gh run list` calls
 *   GEMINI_API_KEY  — optional; without it the LLM narrative is skipped
 *   RESEND_API_KEY  — required when --send is set
 *   GITHUB_REPOSITORY — auto-set in CI; falls back to dotku/sienovo-intl
 *   REPORT_RECIPIENT — override default recipient (sienovojay@gmail.com)
 *
 * Phase 1 implements `daily` only and reproduces the prior daily-report.yml
 * behavior. Weekly / monthly stubs throw until implemented in Phases 2 / 3.
 */
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------- args ----------

const args = parseArgs(process.argv.slice(2));
if (!args.period) {
  console.error("error: --period is required (daily|weekly|monthly)");
  process.exit(2);
}

const REPO = process.env.GITHUB_REPOSITORY || "dotku/sienovo-intl";
const RECIPIENT = process.env.REPORT_RECIPIENT || "sienovojay@gmail.com";

// ---------- main ----------

const config = configFor(args.period);
const metrics = gatherMetrics(config);
const summary = await generateNarrative(metrics, config);
const subject = `[sienovo-intl] ${config.subjectLabel} ${metrics.dateLabel}`;
const html = renderHtml({ metrics, summary, config });

if (args["dry-run"] || !args.send) {
  console.log(JSON.stringify({ subject, recipient: RECIPIENT, summary, metrics, html }, null, 2));
  process.exit(0);
}

const sendResult = await sendEmail({ subject, html });
console.log(JSON.stringify(sendResult));
if (!sendResult.ok) process.exit(1);

// ---------- arg parsing ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--send" || a === "--dry-run") {
      out[a.slice(2)] = true;
    } else if (a.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

// ---------- period config ----------

function configFor(period) {
  const now = new Date();
  switch (period) {
    case "daily":
      return {
        period: "daily",
        sinceISO: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        windowLabel: "近 24 小时",
        subjectLabel: "每日报告",
        h1: "sienovo-intl 每日报告",
      };
    case "weekly":
    case "monthly":
      throw new Error(`period=${period} not implemented yet (Phase 2/3)`);
    default:
      throw new Error(`unknown period: ${period}`);
  }
}

// ---------- metric gathering ----------

function gatherMetrics(config) {
  const sinceISO = config.sinceISO;
  const sinceGit = sinceISO; // git understands ISO-8601 directly

  const synced = countCommitTotal(`git log --since="${sinceGit}" --pretty=%s -- content/blog/`, /^sync: fetch (\d+)/);
  const translated = countCommitTotal(`git log --since="${sinceGit}" --pretty=%s -- content/blog-en/`, /^translate: add (\d+)/);

  const blog = countMdx("content/blog");
  const blogEn = countMdx("content/blog-en");
  const remaining = Math.max(0, blog - blogEn);

  const syncRun = latestRun("sync-blog.yml");
  const translateRun = latestRun("translate-blog.yml");

  // Feature commits (non-bot) in the window
  const subjects = sh(`git log --since="${sinceGit}" --pretty=format:%s --no-merges`).split("\n")
    .map(l => l.trim())
    .filter(l => l && !/^(translate:|sync:) /.test(l));
  const breakdown = bucketByConventionalType(subjects);

  // Same window, with body — used to feed the LLM
  const detail = subjects.length === 0
    ? ""
    : sh(`git log --since="${sinceGit}" --pretty=format:'- %s%n%b' --no-merges`)
        .split(/\n(?=- )/)
        .map(b => b.trim())
        .filter(b => b && !/^- (translate:|sync:) /.test(b))
        .join("\n\n");

  return {
    dateLabel: new Date().toISOString().slice(0, 10),
    windowLabel: config.windowLabel,
    synced,
    translated,
    blog,
    blogEn,
    remaining,
    syncStatus: syncRun.conclusion || "no-run",
    syncUrl: syncRun.url || "",
    translateStatus: translateRun.conclusion || "no-run",
    translateUrl: translateRun.url || "",
    commitsTotal: subjects.length,
    commitsBreakdown: breakdown,
    commitsDetail: detail,
  };
}

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function countCommitTotal(cmd, re) {
  return sh(cmd).split("\n").reduce((sum, line) => {
    const m = line.match(re);
    return sum + (m ? Number(m[1]) : 0);
  }, 0);
}

function countMdx(dir) {
  let count = 0;
  function walk(d) {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const name of entries) {
      const p = join(d, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (name.endsWith(".mdx")) count++;
    }
  }
  walk(dir);
  return count;
}

function latestRun(workflowFile) {
  if (!process.env.GH_TOKEN) return {};
  const out = sh(`gh run list --workflow=${workflowFile} --limit 1 --json conclusion,url --jq '.[0]'`);
  if (!out) return {};
  try { return JSON.parse(out); } catch { return {}; }
}

function bucketByConventionalType(subjects) {
  const buckets = new Map();
  for (const s of subjects) {
    const m = s.match(/^([a-z][a-z0-9]*)(?:\([^)]*\))?!?:/);
    const type = m ? m[1] : "other";
    buckets.set(type, (buckets.get(type) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} ${n}`)
    .join(" · ");
}

// ---------- LLM narrative ----------

async function generateNarrative(metrics, config) {
  if (metrics.commitsTotal === 0) return "";
  if (!process.env.GEMINI_API_KEY) return "";

  const prompt = [
    "你是 sienovo-intl 项目（Sienovo 边缘 AI 视觉计算公司的官网与业务平台）的工程日报助手。",
    "请阅读以下 git commits，用中文写一段 2-3 句的工作内容总结：",
    "- 描述工作主题与达成的成果，而不是逐条罗列 commit",
    "- 输出纯文本，不要使用 Markdown、不要分段编号、不要前缀",
    "- 控制在 80 字以内",
    "",
    `${config.windowLabel} commits：`,
    metrics.commitsDetail || "(无)",
  ].join("\n");

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
            // Disable Gemini 2.5 Flash's default thinking; otherwise it eats
            // maxOutputTokens before producing the visible reply.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim();
  } catch (err) {
    console.error(`::warning::Gemini call failed: ${err.message}`);
    return "";
  }
}

// ---------- HTML rendering ----------

function htmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function statusLabel(s) {
  switch (s) {
    case "success": return "成功";
    case "failure": return "失败";
    case "cancelled": return "已取消";
    case "no-run": return "未运行";
    default: return s;
  }
}

function renderHtml({ metrics, summary, config }) {
  const cellBorder = "border-bottom:1px solid #eee";

  const commitsCell = metrics.commitsTotal === 0
    ? '<span style="color:#999">无</span>'
    : metrics.commitsBreakdown
      ? `<b>${metrics.commitsTotal}</b> 条 <span style="color:#666;font-size:12px">(${htmlEscape(metrics.commitsBreakdown)})</span>`
      : `<b>${metrics.commitsTotal}</b> 条`;

  let summaryBlock = "";
  let aiDisclaimer = "";
  if (summary) {
    const escaped = htmlEscape(summary).replace(/\n/g, "<br>");
    summaryBlock = `
            <h3 style="margin:24px 0 8px;font-size:15px">今日工作总结</h3>
            <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 8px">${escaped}</p>`;
    aiDisclaimer = `
            <p style="color:#999;font-size:11px;font-style:italic;line-height:1.5;border-top:1px solid #eee;padding-top:12px;margin:24px 0 4px">
              注：AI 生成的总结与建议仅供参考，可能存在信息遗漏、偏差或误导；执行人员应自行评估判断后再作最终决策。
            </p>`;
  }

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;max-width:600px;margin:0 auto;color:#0a0a0a">
            <h2 style="margin:0 0 4px">${config.h1}</h2>
            <p style="color:#666;margin:0 0 16px">${metrics.dateLabel}（UTC）</p>
            <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
              <tr><td style="${cellBorder}">${metrics.windowLabel}新抓取</td><td style="${cellBorder};text-align:right"><b>${metrics.synced}</b> 篇</td></tr>
              <tr><td style="${cellBorder}">${metrics.windowLabel}翻译完成</td><td style="${cellBorder};text-align:right"><b>${metrics.translated}</b> 篇</td></tr>
              <tr><td style="${cellBorder}">总数（中 / 英）</td><td style="${cellBorder};text-align:right">${metrics.blog} / ${metrics.blogEn}</td></tr>
              <tr><td style="${cellBorder}">剩余待翻译</td><td style="${cellBorder};text-align:right"><b>${metrics.remaining}</b> 篇</td></tr>
              <tr><td style="${cellBorder}">最新同步任务</td><td style="${cellBorder};text-align:right"><a href="${metrics.syncUrl}">${statusLabel(metrics.syncStatus)}</a></td></tr>
              <tr><td style="${cellBorder}">最新翻译任务</td><td style="${cellBorder};text-align:right"><a href="${metrics.translateUrl}">${statusLabel(metrics.translateStatus)}</a></td></tr>
              <tr><td>${metrics.windowLabel}功能提交</td><td style="text-align:right">${commitsCell}</td></tr>
            </table>${summaryBlock}${aiDisclaimer}
            <p style="color:#999;font-size:12px;margin-top:16px">来自 <a href="https://github.com/${REPO}">${REPO}</a></p>
          </div>`;
}

// ---------- Resend ----------

async function sendEmail({ subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  const payload = {
    from: "sienovo-intl <onboarding@resend.dev>",
    to: [RECIPIENT],
    subject,
    html,
  };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await resp.text();
  const ok = resp.status === 200;
  if (!ok) console.error(`::error::Resend HTTP ${resp.status} ${body.slice(0, 500)}`);
  return { ok, status: resp.status, body: body.slice(0, 500) };
}
