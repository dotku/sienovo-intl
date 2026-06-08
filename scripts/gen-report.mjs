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
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------- args ----------

const args = parseArgs(process.argv.slice(2));
if (!args.period) {
  console.error("error: --period is required (daily|weekly|monthly)");
  process.exit(2);
}

const REPO = process.env.GITHUB_REPOSITORY || "dotku/sienovo-intl";
const RECIPIENT = process.env.REPORT_RECIPIENT || "sienovojay@gmail.com";

// Repo paths for cross-project tracking. marine lives under a different org
// (jytech2023), so the workflow needs a PAT with access to both orgs in
// $GH_TOKEN — the default ${{ github.token }} from CI is repo-scoped and
// will return 404 for jytech2023/*. The script handles 404 gracefully.
const OTHER_PROJECTS = [
  { repo: "dotku/sienovo-cn", label: "sienovo-cn", note: "中文站点 (Vite + React)" },
  { repo: "jytech2023/sienovo-marine", label: "sienovo-marine", note: "Marine 业务 (Next.js + Neon)" },
];

// ---------- main ----------

const config = configFor(args.period);
const metrics = gatherMetrics(config, { sinceISO: config.sinceISO });
if (config.dbEnabled) {
  metrics.db = await gatherDbMetrics({ sinceISO: config.sinceISO });
}
if (config.previousSinceISO) {
  // Compute the prior window so the report can show period-over-period deltas.
  metrics.previous = gatherMetrics(config, {
    sinceISO: config.previousSinceISO,
    untilISO: config.sinceISO,
  });
  if (config.dbEnabled) {
    metrics.previous.db = await gatherDbMetrics({
      sinceISO: config.previousSinceISO,
      untilISO: config.sinceISO,
    });
  }
}
if (config.includeOtherProjects) {
  metrics.otherProjects = await gatherOtherProjectsActivity(config);
}
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
  const days = (n) => new Date(now.getTime() - n * 24 * 3600 * 1000).toISOString();
  switch (period) {
    case "daily":
      return {
        period: "daily",
        sinceISO: days(1),
        windowLabel: "近 24 小时",
        rangeLabel: new Date().toISOString().slice(0, 10),
        subjectLabel: "每日报告",
        h1: "sienovo-intl 每日报告",
        summaryHeading: "今日工作总结",
        maxOutputTokens: 600,
        dbEnabled: false,
      };
    case "weekly":
      return {
        period: "weekly",
        sinceISO: days(7),
        windowLabel: "本周",
        rangeLabel: `${days(7).slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
        subjectLabel: "周报",
        h1: "sienovo-intl 周报",
        summaryHeading: "本周工作总结与下周建议",
        maxOutputTokens: 1500,
        dbEnabled: true,
        includeOtherProjects: true,
      };
    case "monthly":
      return {
        period: "monthly",
        sinceISO: days(30),
        previousSinceISO: days(60),
        windowLabel: "本月",
        previousLabel: "上月",
        rangeLabel: `${days(30).slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
        subjectLabel: "月报",
        h1: "sienovo-intl 月报",
        summaryHeading: "月度复盘与下阶段战略建议",
        maxOutputTokens: 2400,
        dbEnabled: true,
        includeOtherProjects: true,
      };
    default:
      throw new Error(`unknown period: ${period}`);
  }
}

// ---------- metric gathering ----------

function gatherMetrics(config, { sinceISO, untilISO }) {
  const sinceArg = `--since="${sinceISO}"`;
  const untilArg = untilISO ? ` --until="${untilISO}"` : "";

  const synced = countCommitTotal(`git log ${sinceArg}${untilArg} --pretty=%s -- content/blog/`, /^sync: fetch (\d+)/);
  const translated = countCommitTotal(`git log ${sinceArg}${untilArg} --pretty=%s -- content/blog-en/`, /^translate: add (\d+)/);

  // For point-in-time totals we always reflect "now" — they only matter for the current window.
  const isPrevious = !!untilISO;
  const blog = isPrevious ? null : countMdx("content/blog");
  const blogEn = isPrevious ? null : countMdx("content/blog-en");
  const remaining = isPrevious ? null : Math.max(0, blog - blogEn);

  const syncRun = isPrevious ? {} : latestRun("sync-blog.yml");
  const translateRun = isPrevious ? {} : latestRun("translate-blog.yml");

  // Feature commits (non-bot) in the window
  const subjects = sh(`git log ${sinceArg}${untilArg} --pretty=format:%s --no-merges`).split("\n")
    .map(l => l.trim())
    .filter(l => l && !/^(translate:|sync:) /.test(l));
  const breakdown = bucketByConventionalType(subjects);

  // Same window, with body — used to feed the LLM
  const detail = subjects.length === 0
    ? ""
    : sh(`git log ${sinceArg}${untilArg} --pretty=format:'- %s%n%b' --no-merges`)
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

// ---------- Prompt builders ----------

function buildDailyPrompt(metrics, config) {
  return [
    "你是 sienovo-intl 项目（Sienovo 边缘 AI 视觉计算公司的官网与业务平台）的工程日报助手。",
    "请阅读以下 git commits，用中文写一段 2-3 句的工作内容总结：",
    "- 描述工作主题与达成的成果，而不是逐条罗列 commit",
    "- 输出纯文本，不要使用 Markdown、不要分段编号、不要前缀",
    "- 控制在 80 字以内",
    "",
    `${config.windowLabel} commits：`,
    metrics.commitsDetail || "(无)",
  ].join("\n");
}

function buildWeeklyPrompt(metrics, config) {
  const db = metrics.db?.summary || {};
  const apiUsageLines = (metrics.db?.apiUsage || [])
    .map(r => `  - ${r.service}: ${r.total} 次（失败 ${r.failures}）`)
    .join("\n") || "  - (无 ApiUsage 记录)";

  return [
    "你是 Sienovo（边缘 AI 视觉计算公司）整体运营的周报顾问。Sienovo 旗下有三个项目：sienovo-intl（英文站 + 业务平台，主数据源）、sienovo-cn（中文站点）、sienovo-marine（Marine 业务）。本周报以 intl 为核心，但需把另外两个项目的工程活动一并纳入观察。",
    "请阅读以下本周数据，用中文产出三段叙述（共约 200-300 字，纯文本，不要 Markdown、不要标题前缀、不要分点编号）：",
    "1. 本周成果：业务、内容、系统三方面的关键产出与亮点；如关联项目（cn / marine）有显著活动也提一下。",
    "2. 阻塞与风险：从指标里能看出的瓶颈或异常（如外联回复率低、API 失败率上升、Ticket 积压、cn 长期无更新等）。",
    '3. 下周建议：基于本周数据给 2-3 条具体可执行的运营 / 产品 / 工程建议。建议要落地，避免「提升用户体验」这类空话。',
    "段与段之间用空行分隔。",
    "",
    `=== 本周时间窗：${config.rangeLabel} (UTC) ===`,
    "",
    "[ 内容生产 ]",
    `  新抓取 CSDN 文章: ${metrics.synced} 篇`,
    `  新增英文翻译: ${metrics.translated} 篇`,
    `  当前总数: 中 ${metrics.blog} / 英 ${metrics.blogEn}`,
    `  剩余待翻译: ${metrics.remaining} 篇`,
    "",
    "[ 业务增长 (Postgres) ]",
    `  新增客户公司 (Company): ${db.new_companies ?? "?"}`,
    `  新增联系人 (Contact): ${db.new_contacts ?? "?"}`,
    `  新建对话 (Conversation): ${db.new_conversations ?? "?"}`,
    `  对话消息 (ChatMessage): ${db.new_chat_messages ?? "?"}`,
    `  新增 Ticket: ${db.new_tickets ?? "?"} ｜ 当前未关闭: ${db.open_tickets ?? "?"}`,
    `  新增订单 (Order): ${db.new_orders ?? "?"}`,
    `  新发 Outreach 邮件: ${db.new_outreach ?? "?"}`,
    `  Marine 新会话: ${db.new_vessel_sessions ?? "?"} (新增 Vessel: ${db.new_vessels ?? "?"})`,
    `  新增知识文章: ${db.new_articles ?? "?"}`,
    `  产品新增/更新: ${db.product_changes ?? "?"}`,
    "",
    "[ Outreach 邮件状态分布 ]",
    (metrics.db?.outreachByStatus || []).map(r => `  - ${r.status}: ${r.total}`).join("\n") || "  - (无)",
    "",
    "[ 订单状态分布 ]",
    (metrics.db?.ordersByStatus || []).map(r => `  - ${r.status}: ${r.total}`).join("\n") || "  - (无)",
    "",
    "[ API 调用 (Top 8 by service) ]",
    apiUsageLines,
    "",
    "[ 工程提交 (sienovo-intl) ]",
    `  本周提交: ${metrics.commitsTotal} 条 (${metrics.commitsBreakdown || "无分类"})`,
    "  代表性 commit:",
    truncate(metrics.commitsDetail, 1500) || "  (无非机器人提交)",
    "",
    "[ 关联项目工程活动 ]",
    formatOtherProjectsForPrompt(metrics.otherProjects),
  ].join("\n");
}

function formatOtherProjectsForPrompt(others) {
  if (!others || !others.length) return "  (未拉取)";
  return others.map((p) => {
    if (p.error) return `  - ${p.label} (${p.note}): 拉取失败 ${p.error}`;
    if (p.total === 0) return `  - ${p.label} (${p.note}): 无新提交`;
    const recent = p.recent?.length ? `；最近: ${p.recent.slice(0, 3).join(" | ")}` : "";
    return `  - ${p.label} (${p.note}): ${p.total} 条 (${p.breakdown})${recent}`;
  }).join("\n");
}

function truncate(s, max) {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max) + "\n…(以下省略)";
}

function buildMonthlyPrompt(metrics, config) {
  const cur = metrics.db?.summary || {};
  const prv = metrics.previous?.db?.summary || {};

  const fmtDelta = (curVal, prvVal) => {
    const c = curVal ?? 0, p = prvVal ?? 0;
    const diff = c - p;
    const pct = p === 0 ? (c > 0 ? "n/a (上月为 0)" : "0%") : `${diff >= 0 ? "+" : ""}${Math.round((diff / p) * 100)}%`;
    return `${c}（上月 ${p}，环比 ${diff >= 0 ? "+" : ""}${diff}, ${pct}）`;
  };

  const apiCurrent = (metrics.db?.apiUsage || [])
    .map(r => `  - ${r.service}: ${r.total} 次（失败 ${r.failures}, ${r.total ? Math.round(r.failures / r.total * 100) : 0}%）`)
    .join("\n") || "  - (无)";

  return [
    "你是 Sienovo（边缘 AI 视觉计算公司）整体运营的月报顾问。Sienovo 旗下有三个项目：sienovo-intl（英文站 + 业务平台，主数据源）、sienovo-cn（中文站点）、sienovo-marine（Marine 业务）。本月报以 intl 数据为核心，但需要把另外两个项目的工程活跃度一并纳入观察。",
    "请阅读以下本月（30 天）数据 + 上月对比，用中文产出四段（共 380-550 字，纯文本，不要 Markdown、不要标题、不要分点编号）：",
    "1. 月度复盘：客户 / 内容 / 系统 / 销售 四条线本月的关键产出与亮点；如有同比增长或下滑要点出；提一下 cn / marine 的开发活动状态。",
    "2. 漏斗分析：从新增 Company → Contact → Conversation → Order 这条转化链中识别瓶颈；如果 Outreach 或 Marine 数据异常也单独点出。",
    "3. 风险与异常：从 ApiUsage 失败率、Ticket 积压、对话量趋势、cn 长期无更新等识别需要立即处理的问题。",
    "4. 下阶段战略建议：基于本月数据 + 环比变化给 3-4 条具体可执行的运营 / 产品 / 销售 / 工程方向的建议；如果某个关联项目（cn / marine）需要重点投入或暂时降级也明确说出来；建议要落地，标明优先级（高/中），避免「拓展国际市场」「优化用户体验」这类空话。",
    "段与段之间用空行分隔。",
    "",
    `=== 本月时间窗：${config.rangeLabel} (UTC) ===`,
    "",
    "[ 内容生产 ]",
    `  本月新抓取 CSDN 文章: ${fmtDelta(metrics.synced, metrics.previous?.synced)}`,
    `  本月新增英文翻译: ${fmtDelta(metrics.translated, metrics.previous?.translated)}`,
    `  当前总数: 中 ${metrics.blog} / 英 ${metrics.blogEn}（剩余 ${metrics.remaining} 篇待翻译）`,
    "",
    "[ 业务增长（本月 vs 上月） ]",
    `  新增客户公司 (Company): ${fmtDelta(cur.new_companies, prv.new_companies)}`,
    `  新增联系人 (Contact): ${fmtDelta(cur.new_contacts, prv.new_contacts)}`,
    `  新建对话 (Conversation): ${fmtDelta(cur.new_conversations, prv.new_conversations)}`,
    `  对话消息总数 (ChatMessage): ${fmtDelta(cur.new_chat_messages, prv.new_chat_messages)}`,
    `  新增 Ticket: ${fmtDelta(cur.new_tickets, prv.new_tickets)}（当前未关闭 ${cur.open_tickets ?? "?"} 张）`,
    `  新增订单 (Order): ${fmtDelta(cur.new_orders, prv.new_orders)}`,
    `  新发 Outreach 邮件: ${fmtDelta(cur.new_outreach, prv.new_outreach)}`,
    `  Marine 新会话: ${fmtDelta(cur.new_vessel_sessions, prv.new_vessel_sessions)}（新增 Vessel: ${fmtDelta(cur.new_vessels, prv.new_vessels)})`,
    `  新增知识文章: ${fmtDelta(cur.new_articles, prv.new_articles)}`,
    `  产品新增/更新: ${fmtDelta(cur.product_changes, prv.product_changes)}`,
    "",
    "[ Outreach 邮件状态分布 (本月) ]",
    (metrics.db?.outreachByStatus || []).map(r => `  - ${r.status}: ${r.total}`).join("\n") || "  - (无)",
    "",
    "[ 订单状态分布 (本月) ]",
    (metrics.db?.ordersByStatus || []).map(r => `  - ${r.status}: ${r.total}`).join("\n") || "  - (无)",
    "",
    "[ API 调用 (本月 Top 8) ]",
    apiCurrent,
    "",
    "[ 工程提交 (sienovo-intl 本月) ]",
    `  本月: ${metrics.commitsTotal} 条 (${metrics.commitsBreakdown || "无分类"})`,
    `  上月: ${metrics.previous?.commitsTotal ?? 0} 条 (${metrics.previous?.commitsBreakdown || "无分类"})`,
    "  代表性 commit (本月):",
    truncate(metrics.commitsDetail, 1200) || "  (无非机器人提交)",
    "",
    "[ 关联项目工程活动 (本月) ]",
    formatOtherProjectsForPrompt(metrics.otherProjects),
  ].join("\n");
}

// ---------- Cross-project commit activity ----------

async function gatherOtherProjectsActivity(config) {
  if (!process.env.GH_TOKEN) {
    console.error("::warning::GH_TOKEN not set; skipping cross-project activity");
    return [];
  }
  const since = config.sinceISO;
  const out = [];
  for (const p of OTHER_PROJECTS) {
    try {
      const params = new URLSearchParams({ since, per_page: "100" });
      const resp = await fetch(`https://api.github.com/repos/${p.repo}/commits?${params}`, {
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.error(`::warning::GitHub API ${resp.status} for ${p.repo}: ${txt.slice(0, 200)}`);
        out.push({ ...p, error: `HTTP ${resp.status}`, total: 0 });
        continue;
      }
      const commits = await resp.json();
      // Filter out bot/infrastructure commits to match intl's filtering style.
      const subjects = commits
        .map((c) => (c.commit?.message || "").split("\n")[0].trim())
        .filter((s) => s && !/^(translate:|sync:) /.test(s));
      const breakdown = bucketByConventionalType(subjects);
      out.push({
        ...p,
        total: subjects.length,
        breakdown,
        recent: subjects.slice(0, 5),
      });
    } catch (err) {
      console.error(`::warning::Failed to fetch ${p.repo}: ${err.message}`);
      out.push({ ...p, error: err.message, total: 0 });
    }
  }
  return out;
}

// ---------- Postgres metrics (weekly / monthly) ----------

async function gatherDbMetrics({ sinceISO, untilISO }) {
  if (!process.env.DATABASE_URL) {
    console.error("::warning::DATABASE_URL not set; skipping DB metrics");
    return null;
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Time-window predicate, parameterized: $1 = since, $2 = until or NULL for now.
    const win = (col) => `"${col}" >= $1 AND ($2::timestamptz IS NULL OR "${col}" < $2)`;
    const isPrev = !!untilISO;
    const params = [sinceISO, untilISO || null];

    const summaryRow = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM "Company" WHERE ${win("createdAt")})                AS new_companies,
         (SELECT COUNT(*)::int FROM "Contact" WHERE ${win("createdAt")})                AS new_contacts,
         (SELECT COUNT(*)::int FROM "Conversation" WHERE ${win("createdAt")})           AS new_conversations,
         (SELECT COUNT(*)::int FROM "ChatMessage" WHERE ${win("createdAt")})            AS new_chat_messages,
         (SELECT COUNT(*)::int FROM "Ticket" WHERE ${win("createdAt")})                 AS new_tickets,
         ${isPrev ? "0::int" : `(SELECT COUNT(*)::int FROM "Ticket" WHERE status <> 'closed')`} AS open_tickets,
         (SELECT COUNT(*)::int FROM "Order" WHERE ${win("createdAt")})                  AS new_orders,
         (SELECT COUNT(*)::int FROM "OutreachEmail" WHERE ${win("createdAt")})          AS new_outreach,
         (SELECT COUNT(*)::int FROM "Vessel" WHERE ${win("createdAt")})                 AS new_vessels,
         (SELECT COUNT(*)::int FROM "VesselSession" WHERE ${win("startedAt")})          AS new_vessel_sessions,
         (SELECT COUNT(*)::int FROM "KnowledgeArticle" WHERE ${win("createdAt")})       AS new_articles,
         (SELECT COUNT(*)::int FROM "Product"
           WHERE ((${win("createdAt")}) OR (${win("updatedAt")})))                       AS product_changes`,
      params
    );
    const summary = summaryRow.rows[0];

    const apiUsage = (await client.query(
      `SELECT service,
              COUNT(*)::int AS total,
              SUM(CASE WHEN success THEN 0 ELSE 1 END)::int AS failures
         FROM "ApiUsage"
        WHERE ${win("createdAt")}
        GROUP BY service
        ORDER BY total DESC
        LIMIT 8`,
      params
    )).rows;

    const outreachByStatus = (await client.query(
      `SELECT status, COUNT(*)::int AS total
         FROM "OutreachEmail"
        WHERE ${win("createdAt")}
        GROUP BY status
        ORDER BY total DESC`,
      params
    )).rows;

    const ordersByStatus = (await client.query(
      `SELECT status, COUNT(*)::int AS total
         FROM "Order"
        WHERE ${win("createdAt")}
        GROUP BY status
        ORDER BY total DESC`,
      params
    )).rows;

    // Knowledge base / RAG health — current snapshot (not windowed). Surfaces
    // silent failures: errors piling up, or chunks stored without an embedding.
    const kbStatus = (await client.query(
      `SELECT "indexStatus", COUNT(*)::int AS total
         FROM "KnowledgeFile" WHERE "trashedAt" IS NULL
        GROUP BY "indexStatus" ORDER BY total DESC`
    )).rows;
    let kbChunks = { chunks: 0, embedded: 0 };
    try {
      kbChunks = (await client.query(
        `SELECT COUNT(*)::int AS chunks, COUNT(embedding)::int AS embedded FROM "KnowledgeChunk"`
      )).rows[0];
    } catch {
      // embedding column may not exist on an un-migrated DB
    }

    return { summary, apiUsage, outreachByStatus, ordersByStatus, kbStatus, kbChunks };
  } finally {
    await client.end();
  }
}

// ---------- LLM narrative ----------

async function generateNarrative(metrics, config) {
  if (config.period === "daily" && metrics.commitsTotal === 0) return "";
  if (!process.env.GEMINI_API_KEY) return "";

  const prompt =
    config.period === "daily" ? buildDailyPrompt(metrics, config)
    : config.period === "monthly" ? buildMonthlyPrompt(metrics, config)
    : buildWeeklyPrompt(metrics, config);

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
            maxOutputTokens: config.maxOutputTokens || 600,
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

function deltaSpan(curr, prev) {
  if (prev == null) return "";
  const diff = curr - prev;
  if (diff === 0) return ' <span style="color:#999;font-size:11px">(持平)</span>';
  const pct = prev === 0 ? "" : `, ${diff >= 0 ? "+" : ""}${Math.round((diff / prev) * 100)}%`;
  const sign = diff > 0 ? "+" : "";
  const color = diff > 0 ? "#0a7a0a" : "#a04040";
  return ` <span style="color:${color};font-size:11px">(${sign}${diff}${pct})</span>`;
}

function renderOtherProjectsSection(others) {
  if (!others || !others.length) return "";
  const cellBorder = "border-bottom:1px solid #eee";
  const rows = others.map((p) => {
    const totalCell = p.error
      ? `<span style="color:#a04040;font-size:12px">拉取失败: ${htmlEscape(p.error)}</span>`
      : p.total === 0
        ? '<span style="color:#999">无</span>'
        : p.breakdown
          ? `<b>${p.total}</b> 条 <span style="color:#666;font-size:12px">(${htmlEscape(p.breakdown)})</span>`
          : `<b>${p.total}</b> 条`;
    return `<tr><td style="${cellBorder}"><b>${htmlEscape(p.label)}</b><br><span style="color:#888;font-size:11px">${htmlEscape(p.note)}</span></td><td style="${cellBorder};text-align:right;vertical-align:top">${totalCell}</td></tr>`;
  }).join("");

  return `
            <h3 style="margin:24px 0 8px;font-size:15px">关联项目工程活动</h3>
            <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
              ${rows}
            </table>`;
}

function renderKbHealth(kbStatus, kbChunks) {
  const get = (s) => (kbStatus || []).find((r) => r.indexStatus === s)?.total || 0;
  const indexed = get("indexed");
  const error = get("error");
  const unsupported = get("unsupported");
  const pending = get("pending") + get("processing");
  const chunks = kbChunks?.chunks || 0;
  const embedded = kbChunks?.embedded || 0;
  const warn = error > 0 || pending > 0 || chunks !== embedded;
  const red = (n) => `<span style="color:#a04040"><b>${n}</b></span>`;
  return `<p style="margin:0;font-size:13px">
    已索引 <b>${indexed}</b> ·
    error ${error > 0 ? red(error) : "<b>0</b>"} ·
    unsupported <b>${unsupported}</b> ·
    pending ${pending > 0 ? red(pending) : "<b>0</b>"} ·
    向量 ${chunks === embedded ? `<b>${chunks}</b>` : red(`${embedded}/${chunks}`)}
    ${warn ? ' <span style="color:#a04040">⚠ 需关注</span>' : " ✅"}
  </p>`;
}

function renderDbSection(db, prevDb) {
  if (!db || !db.summary) return "";
  const s = db.summary;
  const p = prevDb?.summary;
  const cellBorder = "border-bottom:1px solid #eee";
  const row = (label, val, prev) =>
    `<tr><td style="${cellBorder}">${label}</td><td style="${cellBorder};text-align:right"><b>${val}</b>${deltaSpan(val, prev)}</td></tr>`;
  const dualRow = (label, val1, val2, prev1, prev2) => {
    const inner = `<b>${val1}</b> / <b>${val2}</b>${prev1 != null && prev2 != null ? deltaSpan(val1 + val2, prev1 + prev2) : ""}`;
    return `<tr><td style="${cellBorder}">${label}</td><td style="${cellBorder};text-align:right">${inner}</td></tr>`;
  };

  const apiRows = (db.apiUsage || []).map(r => {
    const failPct = r.total ? Math.round((r.failures / r.total) * 100) : 0;
    const fail = r.failures > 0 ? ` <span style="color:#a04040">(失败 ${r.failures}, ${failPct}%)</span>` : "";
    return `<tr><td style="${cellBorder};font-family:monospace;font-size:12px">${htmlEscape(r.service)}</td><td style="${cellBorder};text-align:right">${r.total}${fail}</td></tr>`;
  }).join("") || `<tr><td colspan="2" style="${cellBorder};color:#999;font-style:italic;text-align:center">无 API 调用记录</td></tr>`;

  const pillRow = (rows, emptyMsg) => {
    if (!rows || !rows.length) return `<span style="color:#999;font-size:12px;font-style:italic">${emptyMsg}</span>`;
    return rows.map(r => `<span style="display:inline-block;background:#f4f4f4;border-radius:10px;padding:2px 10px;margin:0 4px 4px 0;font-size:12px">${htmlEscape(r.status)}: <b>${r.total}</b></span>`).join("");
  };

  return `
            <h3 style="margin:24px 0 8px;font-size:15px">业务增长${p ? "（环比上月）" : ""}</h3>
            <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
              ${row("新增客户公司", s.new_companies, p?.new_companies)}
              ${row("新增联系人", s.new_contacts, p?.new_contacts)}
              ${row("新建对话", s.new_conversations, p?.new_conversations)}
              ${row("对话消息总数", s.new_chat_messages, p?.new_chat_messages)}
              <tr><td style="${cellBorder}">新增 Ticket / 未关闭</td><td style="${cellBorder};text-align:right"><b>${s.new_tickets}</b>${deltaSpan(s.new_tickets, p?.new_tickets)} / <b>${s.open_tickets}</b></td></tr>
              ${row("新增订单", s.new_orders, p?.new_orders)}
              ${row("新发 Outreach 邮件", s.new_outreach, p?.new_outreach)}
              ${dualRow("Marine 新会话 / 新船只", s.new_vessel_sessions, s.new_vessels, p?.new_vessel_sessions, p?.new_vessels)}
              ${row("新增知识文章", s.new_articles, p?.new_articles)}
              <tr><td>产品新增/更新</td><td style="text-align:right"><b>${s.product_changes}</b>${deltaSpan(s.product_changes, p?.product_changes)}</td></tr>
            </table>

            <h3 style="margin:24px 0 8px;font-size:15px">Outreach / 订单状态</h3>
            <p style="margin:0 0 6px;font-size:13px"><b style="color:#666">Outreach: </b>${pillRow(db.outreachByStatus, "无")}</p>
            <p style="margin:0 0 6px;font-size:13px"><b style="color:#666">Order: </b>${pillRow(db.ordersByStatus, "无")}</p>

            <h3 style="margin:24px 0 8px;font-size:15px">API 调用 (Top 8)</h3>
            <table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:13px">
              ${apiRows}
            </table>

            <h3 style="margin:24px 0 8px;font-size:15px">知识库 / RAG 健康</h3>
            ${renderKbHealth(db.kbStatus, db.kbChunks)}`;
}

// Reads the latest data/seo-reports/*.json (written by gsc-pull.mjs) and renders
// a compact Search Console snapshot. Returns "" when no report exists.
function renderSeoSection() {
  let rep;
  try {
    const dir = join(process.cwd(), "data/seo-reports");
    // Only the date-named gsc-pull reports (YYYY-MM-DD.json) — skip the
    // coverage-*.json files, which sort later but have a different shape.
    const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    if (!files.length) return "";
    rep = JSON.parse(readFileSync(join(dir, files[files.length - 1]), "utf8"));
  } catch {
    return "";
  }
  const o = rep.overall || {};
  const w = rep.window || {};
  const ctr = o.ctr != null ? (o.ctr * 100).toFixed(2) + "%" : "—";
  const top = (rep.byPage || [])[0];
  const cell = "border-bottom:1px solid #eee";
  const topRow = top
    ? `<tr><td style="${cell}">曝光最高页面</td><td style="${cell};text-align:right;font-size:12px">${htmlEscape((top.keys?.[0] || "").replace("https://intl.sienovo.cn", ""))} <b>${top.impressions}</b></td></tr>`
    : "";
  return `
            <h3 style="margin:24px 0 8px;font-size:15px">SEO / 搜索表现 <span style="color:#999;font-size:12px;font-weight:normal">(${w.start || ""} ~ ${w.end || ""})</span></h3>
            <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
              <tr><td style="${cell}">曝光 / 点击</td><td style="${cell};text-align:right"><b>${o.impressions ?? 0}</b> / <b>${o.clicks ?? 0}</b></td></tr>
              <tr><td style="${cell}">CTR</td><td style="${cell};text-align:right"><b>${ctr}</b></td></tr>
              ${topRow}
            </table>`;
}

function renderHtml({ metrics, summary, config }) {
  const cellBorder = "border-bottom:1px solid #eee";

  const commitsCell = metrics.commitsTotal === 0
    ? '<span style="color:#999">无</span>'
    : metrics.commitsBreakdown
      ? `<b>${metrics.commitsTotal}</b> 条 <span style="color:#666;font-size:12px">(${htmlEscape(metrics.commitsBreakdown)})</span>`
      : `<b>${metrics.commitsTotal}</b> 条`;

  const dbSection = config.dbEnabled ? renderDbSection(metrics.db, metrics.previous?.db) : "";
  const seoSection = config.dbEnabled ? renderSeoSection() : "";
  const otherProjectsSection = renderOtherProjectsSection(metrics.otherProjects);
  const prev = metrics.previous;

  let summaryBlock = "";
  let aiDisclaimer = "";
  if (summary) {
    const escaped = htmlEscape(summary).replace(/\n/g, "<br>");
    summaryBlock = `
            <h3 style="margin:24px 0 8px;font-size:15px">${config.summaryHeading}</h3>
            <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 8px;white-space:pre-line">${escaped}</p>`;
    aiDisclaimer = `
            <p style="color:#999;font-size:11px;font-style:italic;line-height:1.5;border-top:1px solid #eee;padding-top:12px;margin:24px 0 4px">
              注：AI 生成的总结与建议仅供参考，可能存在信息遗漏、偏差或误导；执行人员应自行评估判断后再作最终决策。
            </p>`;
  }

  const confidentialNotice = `
            <p style="color:#666;font-size:11px;line-height:1.5;${aiDisclaimer ? "" : "border-top:1px solid #eee;padding-top:12px;"}margin:8px 0 4px">
              <b style="color:#a04040">CONFIDENTIAL ·  机密信息</b>　本邮件含 sienovo-intl 项目内部数据，仅供指定收件人使用。未经书面许可不得对外分享、转发或转载；违者将依法追究相应法律责任。
            </p>`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;max-width:600px;margin:0 auto;color:#0a0a0a">
            <h2 style="margin:0 0 4px">${config.h1}</h2>
            <p style="color:#666;margin:0 0 16px">${metrics.dateLabel}（UTC）</p>
            <table cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px">
              <tr><td style="${cellBorder}">${metrics.windowLabel} 新抓取</td><td style="${cellBorder};text-align:right"><b>${metrics.synced}</b> 篇${deltaSpan(metrics.synced, prev?.synced)}</td></tr>
              <tr><td style="${cellBorder}">${metrics.windowLabel} 翻译完成</td><td style="${cellBorder};text-align:right"><b>${metrics.translated}</b> 篇${deltaSpan(metrics.translated, prev?.translated)}</td></tr>
              <tr><td style="${cellBorder}">总数（中 / 英）</td><td style="${cellBorder};text-align:right">${metrics.blog} / ${metrics.blogEn}</td></tr>
              <tr><td style="${cellBorder}">剩余待翻译</td><td style="${cellBorder};text-align:right"><b>${metrics.remaining}</b> 篇</td></tr>
              <tr><td style="${cellBorder}">最新同步任务</td><td style="${cellBorder};text-align:right"><a href="${metrics.syncUrl}">${statusLabel(metrics.syncStatus)}</a></td></tr>
              <tr><td style="${cellBorder}">最新翻译任务</td><td style="${cellBorder};text-align:right"><a href="${metrics.translateUrl}">${statusLabel(metrics.translateStatus)}</a></td></tr>
              <tr><td>${metrics.windowLabel} 功能提交</td><td style="text-align:right">${commitsCell}${deltaSpan(metrics.commitsTotal, prev?.commitsTotal)}</td></tr>
            </table>${dbSection}${seoSection}${otherProjectsSection}${summaryBlock}${aiDisclaimer}${confidentialNotice}
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
