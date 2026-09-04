import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

// evidence/ and prompts/ live at the repo root; the Next app runs from web/.
const REPO_ROOT = path.join(process.cwd(), "..");
const PRODUCTS_DIR = path.join(REPO_ROOT, "evidence", "products");
const PROMPTS_DIR = path.join(REPO_ROOT, "prompts");

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1500;

// How far from an active's name a percentage still counts as being "next to" it.
const WINDOW_WORDS = 5;

type Severity = "BLOCK" | "REVIEW" | "FLAG" | "INFO";

// Severity comes from prompts/rules.md, never from the model. Rule 4 is the one
// exception to a flat lookup: the rulebook sets it by how many markers there are.
const SEVERITY: Record<string, Severity> = {
  "1": "BLOCK",
  "2a": "BLOCK",
  "2b": "REVIEW",
  "3": "REVIEW",
  "5": "FLAG",
};

const MODEL_RULE_IDS = ["2a", "2b", "3", "4", "5"] as const;

const BUCKETS = {
  policy: ["1", "2a", "2b", "3"],
  tone: ["4"],
  language: ["5"],
} as const;

type Finding = {
  id: string;
  severity: Severity;
  span: string;
  fix: string;
  note?: string;
};

type ModelFinding = {
  id?: unknown;
  fired?: unknown;
  span?: unknown;
  fix?: unknown;
  markers?: unknown;
};

/* ---------- rule 1: concentration mismatch, checked in code ---------- */

type Active = { names: string[]; percent: number; title: string };

// "Salicylic Acid + LHA 2% Cleanser" -> names ["Salicylic Acid + LHA",
// "Salicylic Acid", "LHA"], percent 2. A title with no percentage (e.g.
// "SPF 50 Sunscreen") has no active to check against.
function activeFromTitle(title: string): Active | null {
  const m = title.match(/^(.*?)\s+(\d+(?:\.\d+)?)%/);
  if (!m) return null;
  const full = m[1].trim();
  const parts = full.split("+").map((s) => s.trim());
  const names = [full, ...parts].filter((n) => n.length > 1);
  return { names: [...new Set(names)], percent: parseFloat(m[2]), title };
}

type Token = { text: string; start: number; end: number };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+%. ]/g, "");
}

type PercentHit = {
  raw: string;
  value: number;
  start: number;
  end: number;
};

function findPercentages(text: string): PercentHit[] {
  const hits: PercentHit[] = [];
  const re = /(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hits.push({
      raw: m[0],
      value: parseFloat(m[1]),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return hits;
}

// Looks for an active's name within WINDOW_WORDS either side of a percentage.
// Returns the character span covering both, so the finding can point at the
// whole "Salicylic Acid + LHA 0.2%" rather than just the number.
function nameNearPercent(
  text: string,
  tokens: Token[],
  hit: PercentHit,
  names: string[],
): { name: string; start: number; end: number } | null {
  const hitIndex = tokens.findIndex((t) => t.end > hit.start && t.start < hit.end);
  if (hitIndex === -1) return null;

  const from = Math.max(0, hitIndex - WINDOW_WORDS);
  const to = Math.min(tokens.length - 1, hitIndex + WINDOW_WORDS);
  const window = tokens.slice(from, to + 1);
  const windowText = normalize(window.map((t) => t.text).join(" "));

  for (const name of names) {
    const needle = normalize(name);
    const at = windowText.indexOf(needle);
    if (at === -1) continue;

    // Map the match back to a character span by walking the window's tokens.
    let cursor = 0;
    let nameStart: number | null = null;
    let nameEnd: number | null = null;
    for (const token of window) {
      const norm = normalize(token.text);
      const tokenStart = cursor;
      const tokenEnd = cursor + norm.length;
      if (tokenEnd > at && nameStart === null) nameStart = token.start;
      if (tokenStart < at + needle.length) nameEnd = token.end;
      cursor = tokenEnd + 1; // the space rejoined above
    }
    if (nameStart === null || nameEnd === null) continue;

    return {
      name,
      start: Math.min(nameStart, hit.start),
      end: Math.max(nameEnd, hit.end),
    };
  }
  return null;
}

function scoreRule1(adText: string, product: Active | null, allActives: Active[]): Finding[] {
  const findings: Finding[] = [];
  const tokens = tokenize(adText);

  for (const hit of findPercentages(adText)) {
    // With a product selected, its own actives are the source of truth.
    if (product) {
      const match = nameNearPercent(adText, tokens, hit, product.names);
      if (match) {
        if (hit.value !== product.percent) {
          findings.push({
            id: "1",
            severity: SEVERITY["1"],
            span: adText.slice(match.start, match.end),
            fix: `Change ${hit.raw} to ${product.percent}% to match the product page ("${product.title}").`,
          });
        }
        continue;
      }
    }

    // No product selected, or the ad names an active the selected product's
    // title says nothing about. Either way there is no fact to check against.
    const names = allActives.flatMap((a) => a.names);
    const match = nameNearPercent(adText, tokens, hit, names);
    if (match) {
      findings.push({
        id: "1",
        severity: "REVIEW",
        span: adText.slice(match.start, match.end),
        fix: product
          ? `Select the product this concentration belongs to, or check ${hit.raw} against its product page.`
          : `Select the product this ad is for so ${hit.raw} can be checked against its product page.`,
        note: "no source to verify against",
      });
    }
  }

  return findings;
}

/* ---------- rules 2a, 2b, 3, 4, 5: the model ---------- */

function severityForRule4(markers: unknown): Severity {
  const count = Array.isArray(markers) ? markers.length : 0;
  return count >= 2 ? "FLAG" : "INFO";
}

function parseModelJson(raw: string): { findings: ModelFinding[] } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : raw).trim();
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.findings)) {
    throw new Error("model JSON has no findings array");
  }
  return parsed;
}

async function scoreWithModel(adText: string, sourceFacts: string): Promise<Finding[]> {
  const [template, rules] = await Promise.all([
    fs.readFile(path.join(PROMPTS_DIR, "scorer.md"), "utf8"),
    fs.readFile(path.join(PROMPTS_DIR, "rules.md"), "utf8"),
  ]);

  const prompt = template
    .replace("{{RULES}}", rules)
    .replace("{{SOURCE_FACTS}}", sourceFacts)
    .replace("{{AD_TEXT}}", adText);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Thinking tokens count against max_tokens, and 1500 is a tight budget for
    // five findings with spans. Off, so the JSON can't get truncated.
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = parseModelJson(raw);
  const findings: Finding[] = [];

  for (const item of parsed.findings) {
    const id = typeof item.id === "string" ? item.id : "";
    if (!MODEL_RULE_IDS.includes(id as (typeof MODEL_RULE_IDS)[number])) continue;
    if (item.fired !== true) continue;

    findings.push({
      id,
      severity: id === "4" ? severityForRule4(item.markers) : SEVERITY[id],
      span: typeof item.span === "string" ? item.span : "",
      fix: typeof item.fix === "string" ? item.fix : "",
    });
  }

  return findings;
}

/* ---------- route ---------- */

async function loadActives(): Promise<{ byHandle: Map<string, Active>; all: Active[] }> {
  const files = (await fs.readdir(PRODUCTS_DIR)).filter((f) => f.endsWith(".json"));
  const byHandle = new Map<string, Active>();
  const all: Active[] = [];

  for (const file of files) {
    const raw = await fs.readFile(path.join(PRODUCTS_DIR, file), "utf8");
    const title: unknown = JSON.parse(raw)?.product?.title;
    if (typeof title !== "string") continue;
    const active = activeFromTitle(title);
    if (!active) continue;
    byHandle.set(file.replace(/\.json$/, ""), active);
    all.push(active);
  }

  return { byHandle, all };
}

async function loadSourceFacts(handle: string): Promise<string> {
  const raw = await fs.readFile(path.join(PRODUCTS_DIR, `${handle}.json`), "utf8");
  const product = JSON.parse(raw)?.product ?? {};
  // Images are URLs and dimensions; they aren't facts about the formula.
  const { images, image, ...facts } = product;
  void images;
  void image;
  return JSON.stringify(facts, null, 2);
}

function verdictFor(findings: Finding[]): "BLOCK" | "REVIEW" | "PASS" {
  if (findings.some((f) => f.severity === "BLOCK")) return "BLOCK";
  if (findings.some((f) => f.severity === "REVIEW")) return "REVIEW";
  return "PASS";
}

export async function POST(request: Request) {
  let body: { ad_text?: unknown; product_handle?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const adText = typeof body.ad_text === "string" ? body.ad_text : "";
  if (!adText.trim()) {
    return NextResponse.json({ error: "ad_text is required" }, { status: 400 });
  }

  const handleInput =
    typeof body.product_handle === "string" && body.product_handle !== "none"
      ? body.product_handle
      : null;

  const { byHandle, all } = await loadActives();

  let handle: string | null = null;
  let sourceFacts = "No product was selected. There are no source facts for this ad.";
  if (handleInput) {
    // Only handles that exist on disk — the input reaches a file path.
    const known = (await fs.readdir(PRODUCTS_DIR)).map((f) => f.replace(/\.json$/, ""));
    if (!known.includes(handleInput)) {
      return NextResponse.json({ error: `unknown product_handle: ${handleInput}` }, { status: 400 });
    }
    handle = handleInput;
    sourceFacts = await loadSourceFacts(handle);
  }

  const findings = scoreRule1(adText, handle ? byHandle.get(handle) ?? null : null, all);

  try {
    findings.push(...(await scoreWithModel(adText, sourceFacts)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `scorer failed: ${message}` }, { status: 502 });
  }

  return NextResponse.json({
    verdict: verdictFor(findings),
    policy: findings.filter((f) => BUCKETS.policy.includes(f.id as never)),
    tone: findings.filter((f) => BUCKETS.tone.includes(f.id as never)),
    language: findings.filter((f) => BUCKETS.language.includes(f.id as never)),
  });
}
