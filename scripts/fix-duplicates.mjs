import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const dir = "C:\\Users\\vince\\sienovo-intl\\content\\blog-en";
const files = readdirSync(dir).filter(f => f.endsWith(".mdx"));
let fixed = 0;

files.forEach(f => {
  const filePath = join(dir, f);
  let content = readFileSync(filePath, "utf-8");
  const normalized = content.replace(/\r\n/g, "\n");
  const parts = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!parts) return;

  let fm = parts[1];
  const body = parts[2];
  const hasExpanded = fm.includes("expanded: true");
  const hasSkipped = fm.includes("expandSkipped: true");

  fm = fm.replace(/expanded: true\n?/g, "");
  fm = fm.replace(/expandSkipped: true\n?/g, "");

  if (hasExpanded) fm += "\nexpanded: true";
  if (hasSkipped) fm += "\nexpandSkipped: true";

  const newContent = `---\n${fm}\n---\n${body}`;
  if (newContent !== normalized) {
    writeFileSync(filePath, newContent);
    fixed++;
  }
});

console.log("Fixed files:", fixed);