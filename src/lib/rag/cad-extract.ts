/**
 * Altium binary CAD extraction (.PcbDoc / .SchDoc).
 *
 * These are OLE2 compound binaries with no extractable prose — but their
 * streams carry the real product signal: IC part numbers, interface nets, and
 * component designators. We mine that signal with a string scan, aggregate it
 * into a structured summary, then have Bedrock Claude turn it into a product
 * narrative the knowledge base can actually use ("a multi-port industrial
 * gateway with an RTL8370 8-port switch, CH348 octal UART, …").
 */

import { bedrockChat, bedrockConfigured } from "@/lib/bedrock";

// Interfaces worth reporting if present on the board.
const INTERFACES = [
  "HDMI", "M.2", "M2", "USB3", "USB2", "USB", "TYPE-C", "PCIE", "SATA",
  "EMMC", "NVME", "DDR4", "DDR3", "DDR2", "DDR", "RJ45", "RS485", "RS232",
  "CAN", "UART", "MIPI", "LVDS", "GMAC", "WIFI", "5G", "4G", "SIM", "TF", "SD",
];

// IC part-number shapes: 2–4 letters + 3+ digits + optional suffix.
const PART_RE = /^[A-Z]{2,4}\d{3,}[A-Z0-9]{0,6}$/;
// A descriptive signal/bus net: an UPPER-led token with a delimited signal word.
const NET_RE = /(?:^|_)(CLK|TX|RX|DATA|HPD|RST|PWR|EMMC|DDR|HDMI|USB|PCIE|SATA|UART|CAN|MIPI|LVDS|MDIO|SCL|SDA)(?:_|\d|$)/;
// Reference designators: a known prefix + digits. Whitelisting the prefix keeps
// BGA ball coordinates (AA1, AV36, …) out of the count.
const DESIG_RE = /^([A-Z]{1,3})\d{1,4}$/;
const DESIG_PREFIXES = new Set([
  "U", "R", "C", "L", "D", "Q", "J", "P", "CN", "CON", "Y", "X", "SW", "K",
  "FB", "RP", "F", "T", "RLY", "RT", "TVS", "VR", "BT", "JP", "TP", "RN",
]);

/** Frequency map of printable-ASCII runs (length ≥ minLen) in the buffer. */
function stringFreq(buf: Buffer, minLen = 4): Map<string, number> {
  const freq = new Map<string, number>();
  let start = -1;
  for (let i = 0; i <= buf.length; i++) {
    const b = i < buf.length ? buf[i] : 0;
    const printable = b >= 0x20 && b <= 0x7e;
    if (printable) {
      if (start < 0) start = i;
    } else {
      if (start >= 0 && i - start >= minLen) {
        const s = buf.toString("latin1", start, i);
        freq.set(s, (freq.get(s) || 0) + 1);
      }
      start = -1;
    }
  }
  return freq;
}

/** Aggregate the raw strings into a compact, structured Markdown summary. */
export function analyzeCad(buffer: Buffer, fileName: string): string {
  const freq = stringFreq(buffer);

  const parts = [];
  const designators = new Map<string, number>();
  const nets = new Set<string>();
  const interfaceHits = new Map<string, number>();

  for (const [tok, count] of freq) {
    if (PART_RE.test(tok) && tok.length >= 5 && tok.length <= 14) {
      parts.push({ tok, count });
    }
    const dm = DESIG_RE.exec(tok);
    if (dm && DESIG_PREFIXES.has(dm[1])) {
      designators.set(dm[1], (designators.get(dm[1]) || 0) + 1);
    }
    if (nets.size < 40 && tok.length >= 6 && tok.length <= 32 && /^[A-Z][A-Z0-9_]+$/.test(tok) && NET_RE.test(tok)) {
      nets.add(tok);
    }
    const up = tok.toUpperCase();
    for (const iface of INTERFACES) {
      if (up.includes(iface)) interfaceHits.set(iface, (interfaceHits.get(iface) || 0) + count);
    }
  }

  const topParts = parts.sort((a, b) => b.count - a.count).slice(0, 25);
  const ifaceList = [...interfaceHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const desigList = [...designators.entries()].sort((a, b) => b[1] - a[1]);

  const lines = [
    `# PCB design extraction: ${fileName}`,
    ``,
    `## Candidate IC / part numbers (by frequency)`,
    ...(topParts.length
      ? topParts.map((p) => `- ${p.tok} ×${p.count}`)
      : ["- (none recognized)"]),
    ``,
    `## Interfaces / buses detected`,
    ifaceList.length ? ifaceList.join(", ") : "(none)",
    ``,
    `## Component designator counts`,
    desigList.length
      ? desigList.map(([k, v]) => `${k}: ${v}`).join(", ")
      : "(none)",
    ``,
    `## Notable signal nets`,
    [...nets].slice(0, 40).join(", ") || "(none)",
  ];
  return lines.join("\n");
}

/** Turn the structured extraction into a product narrative via Bedrock Claude. */
async function narrateCad(structured: string, fileName: string): Promise<string> {
  if (!bedrockConfigured()) return "";
  const prompt = `You are a hardware product analyst at Sienovo (深圳信迈), an edge-AI / industrial computing company. Below is data mined from an Altium PCB design file ("${fileName}") — IC part numbers, detected interfaces, component counts, and signal net names.

Write a concise PRODUCT DESCRIPTION in BOTH English and 中文 (English first, then 中文). Infer and state:
- the likely product type / category,
- key chips and what they do (e.g. RTL8370 = multi-port Gigabit Ethernet switch, CH348 = octal UART bridge),
- the interface/connectivity capabilities,
- plausible target applications.
Be factual and grounded ONLY in the data; if something is uncertain, say "likely". Do not invent model numbers. 200-350 words total.

DATA:
${structured}`;

  try {
    const { text } = await bedrockChat([{ role: "user", content: prompt }], {
      maxTokens: 1200,
    });
    return text.trim();
  } catch (err) {
    console.error("[cad-extract] Bedrock narration failed:", err);
    return "";
  }
}

/**
 * Full pipeline: structured extraction + LLM narrative. The narrative leads
 * (best for retrieval); the raw structured data is appended so exact part
 * numbers / nets remain searchable.
 */
export async function extractCadText(buffer: Buffer, fileName: string): Promise<string> {
  const structured = analyzeCad(buffer, fileName);
  const narrative = await narrateCad(structured, fileName);
  return narrative ? `${narrative}\n\n---\n\n${structured}` : structured;
}

// Altium binary documents we can mine.
export function isAltiumCad(fileName: string): boolean {
  return /\.(pcbdoc|schdoc|prjpcb)$/i.test(fileName);
}
