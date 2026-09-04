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
  policy: Finding[];
  tone: Finding[];
  language: Finding[];
};

const BUCKET_LABELS: { key: keyof Omit<Result, "verdict">; label: string }[] = [
  { key: "policy", label: "Policy" },
  { key: "tone", label: "Tone" },
  { key: "language", label: "Language" },
];

export default function Scorer({ handles }: { handles: string[] }) {
  const [adText, setAdText] = useState("");
  const [handle, setHandle] = useState("none");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);

  async function score() {
    setScoring(true);
    setError(null);
    setResult(null);
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
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScoring(false);
    }
  }

  const buckets = result
    ? BUCKET_LABELS.filter(({ key }) => result[key].length > 0)
    : [];

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

      {error && (
        <p style={{ marginTop: 24, color: "#b00" }}>
          {error}
        </p>
      )}

      {result && (
        <section style={{ marginTop: 32 }}>
          <p style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>{result.verdict}</p>

          {buckets.length === 0 && (
            <p style={{ marginTop: 8 }}>No rules fired. Five rules exist, so this is not a compliance sign-off.</p>
          )}

          {buckets.map(({ key, label }) => (
            <div key={key} style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>{label}</h2>
              {result[key].map((finding, i) => (
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
                      <span style={{ background: "#ffe58f" }}>{finding.span}</span>
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
