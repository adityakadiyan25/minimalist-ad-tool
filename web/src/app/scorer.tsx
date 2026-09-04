"use client";

import { useState } from "react";

type Finding = {
  id: string;
  severity: "BLOCK" | "REVIEW" | "FLAG" | "INFO";
  span: string;
  fix: string;
  note?: string;
};

type Result = {
  verdict: "BLOCK" | "REVIEW" | "PASS";
  rules_checked: number;
  policy: Finding[];
  tone: Finding[];
  language: Finding[];
};

type BucketKey = "policy" | "tone" | "language";

const BUCKETS: { key: BucketKey; label: string }[] = [
  { key: "policy", label: "Policy" },
  { key: "tone", label: "Tone" },
  { key: "language", label: "Language" },
];

function allFindings(result: Result): Finding[] {
  return [...result.policy, ...result.tone, ...result.language];
}

// Merges the findings' spans into non-overlapping ranges over the ad text, so
// the marketer can see where each one is rather than matching quotes by eye.
function highlightRanges(adText: string, findings: Finding[]) {
  const ranges: { start: number; end: number; ids: string[] }[] = [];

  // Keyed by rule AND span, not span alone. One rule firing twice on the same
  // words means two places in the ad, so the cursor advances. Two rules quoting
  // the same headline means one place with two rule numbers on it, so each rule
  // starts its own search and the merge below joins them.
  const searchFrom = new Map<string, number>();

  for (const finding of findings) {
    if (!finding.span) continue;
    const key = `${finding.id}\u0000${finding.span}`;
    const from = searchFrom.get(key) ?? 0;
    const start = adText.indexOf(finding.span, from);
    if (start === -1) continue; // model returned a span that isn't in the text
    searchFrom.set(key, start + finding.span.length);
    ranges.push({ start, end: start + finding.span.length, ids: [finding.id] });
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) {
      last.end = Math.max(last.end, range.end);
      for (const id of range.ids) if (!last.ids.includes(id)) last.ids.push(id);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function MarkedUpAd({ adText, findings }: { adText: string; findings: Finding[] }) {
  const ranges = highlightRanges(adText, findings);
  const nodes = [];
  let cursor = 0;

  for (const [i, range] of ranges.entries()) {
    if (range.start > cursor) nodes.push(adText.slice(cursor, range.start));
    nodes.push(
      <mark key={i} style={{ background: "#ffe58f", color: "#171717", padding: "0 2px" }}>
        {adText.slice(range.start, range.end)}
        <span style={{ fontSize: 11, verticalAlign: "super", marginLeft: 2 }}>
          {range.ids.join(",")}
        </span>
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < adText.length) nodes.push(adText.slice(cursor));

  return (
    <p
      style={{
        whiteSpace: "pre-wrap",
        border: "1px solid #ccc",
        padding: 12,
        margin: "16px 0 0",
      }}
    >
      {nodes}
    </p>
  );
}

export default function Scorer({ handles }: { handles: string[] }) {
  const [adText, setAdText] = useState("");
  const [handle, setHandle] = useState("none");
  const [scored, setScored] = useState<{ text: string; result: Result } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);

  async function score() {
    setScoring(true);
    setError(null);
    setScored(null);
    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_text: adText, product_handle: handle }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? `request failed (${response.status})`);
        return;
      }
      // Keep the text that was scored, so the highlights can't drift out of
      // sync with the textarea once the marketer starts editing.
      setScored({ text: adText, result: data });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScoring(false);
    }
  }

  const findings = scored ? allFindings(scored.result) : [];
  const firedCount = new Set(findings.map((f) => f.id)).size;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Ad scorer</h1>

      <label style={{ display: "block", marginBottom: 4 }}>Ad text</label>
      <textarea
        value={adText}
        onChange={(e) => setAdText(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: 8, fontFamily: "inherit", fontSize: 14 }}
      />

      <label style={{ display: "block", marginTop: 16, marginBottom: 4 }}>Product</label>
      <select
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        style={{ padding: 6, fontSize: 14 }}
      >
        <option value="none">none</option>
        {handles.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={score}
          disabled={scoring || adText.trim() === ""}
          style={{ padding: "8px 16px", fontSize: 14 }}
        >
          {scoring ? "Scoring…" : "Score"}
        </button>
      </div>

      {error && <p style={{ marginTop: 24, color: "#b00" }}>{error}</p>}

      {scored && (
        <section style={{ marginTop: 32 }}>
          <p style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>{scored.result.verdict}</p>
          <p style={{ margin: "4px 0 0", opacity: 0.7 }}>
            {scored.result.rules_checked} rules checked, {firedCount} fired.
          </p>

          <MarkedUpAd adText={scored.text} findings={findings} />

          {BUCKETS.map(({ key, label }) => (
            <div key={key} style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>
                {label}
              </h2>
              {scored.result[key].length === 0 && (
                <p style={{ margin: 0, opacity: 0.7 }}>nothing fired</p>
              )}
              {scored.result[key].map((finding, i) => (
                <div
                  key={`${finding.id}-${i}`}
                  style={{ border: "1px solid #ccc", padding: 12, marginTop: 8 }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    Rule {finding.id} — {finding.severity}
                    {finding.note ? ` (${finding.note})` : ""}
                  </p>
                  {finding.span && (
                    <p style={{ margin: "8px 0 0" }}>
                      <span style={{ background: "#ffe58f", color: "#171717" }}>{finding.span}</span>
                    </p>
                  )}
                  {finding.fix && <p style={{ margin: "8px 0 0" }}>{finding.fix}</p>}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
