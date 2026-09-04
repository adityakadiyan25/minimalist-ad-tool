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

const ALL_RULE_IDS = ["1", "2a", "2b", "3", "4", "5"] as const;
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

type Active = { names: string[]; percent: number; title: string; handle: string };

// "Salicylic Acid + LHA 2% Cleanser" -> names ["Salicylic Acid + LHA",
// "Salicylic Acid", "LHA"], percent 2. A title with no percentage (e.g.
// "SPF 50 Sunscreen") has no active to check against.
function activeFromTitle(title: string, handle: string): Active | null {
  const m = title.match(/^(.*?)\s+(\d+(?:\.\d+)?)%/);
  if (!m) return null;
  const full = m[1].trim();
  const parts = full.split("+").map((s) => s.trim());
  const names = [full, ...parts].filter((n) => n.length > 1);
  return { names: [...new Set(names)], percent: parseFloat(m[2]), title, handle };
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

// Replaces, never deletes: a 1:1 swap keeps the normalized length equal to the
// source length, so offsets map straight back. Deleting made "Alpha-Arbutin"
// into "alphaarbutin", which no active name could ever match.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+%.]/g, " ");
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

// Maps an offset in the normalized window text back to a character span in the
// original ad text, by walking the window's tokens and their normalized lengths.
function mapToChars(
  window: Token[],
  at: number,
  length: number,
): { start: number; end: number } | null {
  let cursor = 0;
  let start: number | null = null;
  let end: number | null = null;
  for (const token of window) {
    const norm = normalize(token.text);
    const tokenStart = cursor;
    const tokenEnd = cursor + norm.length;
    if (tokenEnd > at && start === null) start = token.start;
    if (tokenStart < at + length) end = token.end;
    cursor = tokenEnd + 1; // the space rejoined below
  }
  return start === null || end === null ? null : { start, end };
}

// Looks for the active whose concentration a percentage is stating.
//
// The name has to be immediately adjacent to the number — nothing but spaces and
// punctuation between them. "Niacinamide 10%" states a concentration; "Flat 20%
// off Niacinamide" and "Vitamin C 10%: 92% of users" do not, and neither does the
// "100% vegan" that rules.md itself calls legitimate copy.
//
// When names sit on both sides, the one BEFORE the number wins: that is the form
// all eight product titles use, and the form the brand's copy uses. Without it,
// "Retinal 10% Niacinamide 10%" hands the 10% to Niacinamide, whose page says
// 10%, and a 100x overstatement of a retinoid passes. Distance, then name length,
// break what the first test leaves tied — which is what sends "Salicylic Acid +
// LHA 0.2%" to the cleanser rather than to bare LHA.
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

  type Candidate = { name: string; start: number; end: number; precedes: boolean; distance: number };
  let best: Candidate | null = null;

  for (const name of names) {
    const needle = normalize(name);
    if (needle.trim().length === 0) continue;

    // Every occurrence, not just the first — the same active can appear twice
    // in one window with only one of them next to this percentage.
    for (let at = windowText.indexOf(needle); at !== -1; at = windowText.indexOf(needle, at + 1)) {
      const chars = mapToChars(window, at, needle.length);
      if (chars === null) continue;

      const precedes = chars.end <= hit.start;
      const follows = hit.end <= chars.start;
      if (!precedes && !follows) continue; // overlapping the number itself

      const between = precedes
        ? text.slice(chars.end, hit.start)
        : text.slice(hit.end, chars.start);
      if (/[a-z0-9]/i.test(between)) continue; // a word sits in between: not a concentration

      const candidate: Candidate = {
        name,
        start: Math.min(chars.start, hit.start),
        end: Math.max(chars.end, hit.end),
        precedes,
        distance: between.length,
      };

      if (best === null || betterMatch(candidate, best)) best = candidate;
    }
  }

  return best === null ? null : { name: best.name, start: best.start, end: best.end };
}

function betterMatch(
  a: { precedes: boolean; distance: number; name: string },
  b: { precedes: boolean; distance: number; name: string },
): boolean {
  if (a.precedes !== b.precedes) return a.precedes;
  if (a.distance !== b.distance) return a.distance < b.distance;
  return normalize(a.name).trim().length > normalize(b.name).trim().length;
}

function scoreRule1(adText: string, selected: Active | null, all: Active[]): Finding[] {
  const findings: Finding[] = [];
  const tokens = tokenize(adText);

  // An active belongs to whichever product titles name it. A routine ad names
  // three products, so the selected one can't be the only source we check.
  const owners = new Map<string, Active[]>();
  for (const active of all) {
    for (const name of active.names) {
      const key = normalize(name);
      owners.set(key, [...(owners.get(key) ?? []), active]);
    }
  }
  const names = [...new Set(all.flatMap((a) => a.names))];

  for (const hit of findPercentages(adText)) {
    const match = nameNearPercent(adText, tokens, hit, names);
    if (!match) continue;

    const key = normalize(match.name);
    const span = adText.slice(match.start, match.end);

    // The dropdown is an override: when the selected product owns this active,
    // its title is the source of truth even if another product shares the name.
    const sources =
      selected && selected.names.some((n) => normalize(n) === key)
        ? [selected]
        : owners.get(key) ?? [];

    // An active no title accounts for. Unreachable while every recognised name
    // comes from a title that carries a percentage, but it is the rule.
    if (sources.length === 0) {
      findings.push({
        id: "1",
        severity: "REVIEW",
        span,
        fix: `No product page accounts for ${match.name}. Check ${hit.raw} against its source.`,
        note: "no source to verify against",
      });
      continue;
    }

    if (sources.some((s) => s.percent === hit.value)) continue;

    // Two products can share an active. They agree on the concentration today,
    // so say the number once and name every title it came from.
    const percents = [...new Set(sources.map((s) => s.percent))];
    const titles = sources.map((s) => `"${s.title}"`).join(" or ");
    const page = sources.length === 1 ? "the product page" : "a product page";
    const expected =
      percents.length === 1
        ? `${percents[0]}% to match ${page} (${titles})`
        : `match ${page}: ${sources.map((s) => `${s.percent}% ("${s.title}")`).join(" or ")}`;

    findings.push({
      id: "1",
      severity: SEVERITY["1"],
      span,
      fix: `Change ${hit.raw} to ${expected}.`,
    });
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

  // replaceAll, not replace: a single-occurrence replace filled whichever
  // mention came first in the file, which left the real sections holding
  // literal {{...}} markers.
  const prompt = template
    .replaceAll("{{RULES}}", rules)
    .replaceAll("{{SOURCE_FACTS}}", sourceFacts)
    .replaceAll("{{AD_TEXT}}", adText);

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
    const handle = file.replace(/\.json$/, "");
    const active = activeFromTitle(title, handle);
    if (!active) continue;
    byHandle.set(handle, active);
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
    rules_checked: ALL_RULE_IDS.length,
    policy: findings.filter((f) => BUCKETS.policy.includes(f.id as never)),
    tone: findings.filter((f) => BUCKETS.tone.includes(f.id as never)),
    language: findings.filter((f) => BUCKETS.language.includes(f.id as never)),
  });
}
