#!/usr/bin/env python3
"""Render a Claude Code session JSONL as readable markdown.

The point is an unedited record: every user message, every assistant message,
and every tool call with its result, in the order they happened. Nothing is
summarised. Tool results longer than COLLAPSE_OVER lines go inside a <details>
block so the file stays scannable, but the full text is kept.

Usage: python3 transcript/render.py [input.jsonl] [output.md]
"""

import json
import re
import sys
from collections import Counter
from datetime import datetime

DEFAULT_IN = "transcript/02-scorer-v0.jsonl"
DEFAULT_OUT = "transcript/02-scorer-v0.md"

COLLAPSE_OVER = 40  # tool results longer than this many lines get folded away


def read_records(path):
    records = []
    for number, line in enumerate(open(path, encoding="utf-8"), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as error:
            print(f"skipping unparseable line {number}: {error}", file=sys.stderr)
    return records


def blocks_of(record):
    """The content blocks of a record, as a list. A string content becomes one text block."""
    message = record.get("message")
    if not isinstance(message, dict):
        return []
    content = message.get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    if isinstance(content, list):
        return [b for b in content if isinstance(b, dict)]
    return []


def fence(text, language=""):
    """Fence text in backticks, using more backticks than any run inside it."""
    longest = max((len(m) for m in re.findall(r"`+", text)), default=0)
    ticks = "`" * max(3, longest + 1)
    return f"{ticks}{language}\n{text}\n{ticks}"


def collapsed(summary, body_markdown):
    return f"<details>\n<summary>{summary}</summary>\n\n{body_markdown}\n\n</details>"


def clock(record):
    stamp = record.get("timestamp")
    if not stamp:
        return ""
    try:
        return datetime.fromisoformat(stamp.replace("Z", "+00:00")).strftime("%H:%M:%S")
    except ValueError:
        return stamp


def result_text(block):
    """Flatten a tool_result's content into text, noting any non-text parts."""
    content = block.get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return json.dumps(content, indent=2, ensure_ascii=False)

    parts = []
    for item in content:
        if not isinstance(item, dict):
            parts.append(str(item))
        elif item.get("type") == "text":
            parts.append(item.get("text", ""))
        elif item.get("type") == "image":
            source = item.get("source", {}) or {}
            media = source.get("media_type", "image")
            size = len(source.get("data", "") or "")
            parts.append(f"[{media} returned inline, {size} base64 chars — not embedded here]")
        else:
            parts.append(json.dumps(item, indent=2, ensure_ascii=False))
    return "\n\n".join(parts)


def render_tool_input(tool_input):
    """One line per scalar argument; multi-line strings get their own fenced block."""
    if not isinstance(tool_input, dict):
        return fence(json.dumps(tool_input, indent=2, ensure_ascii=False), "json")
    if not tool_input:
        return "_(no arguments)_"

    out = []
    for key, value in tool_input.items():
        if isinstance(value, str) and "\n" in value:
            out.append(f"**{key}**\n\n{fence(value)}")
        elif isinstance(value, str):
            out.append(f"**{key}**: {fence(value) if '`' in value else '`' + value + '`'}")
        else:
            out.append(f"**{key}**: `{json.dumps(value, ensure_ascii=False)}`")
    return "\n\n".join(out)


def render_tool_result(block):
    if block is None:
        return "_(no result recorded)_"
    text = result_text(block)
    label = "Result (error)" if block.get("is_error") else "Result"
    body = fence(text)
    lines = text.count("\n") + 1
    if lines > COLLAPSE_OVER:
        return collapsed(f"{label} — {lines} lines", body)
    return f"**{label}**\n\n{body}"


def render(records):
    # Tool results arrive on later user records; pair them with their call.
    results = {}
    for record in records:
        for block in blocks_of(record):
            if block.get("type") == "tool_result" and block.get("tool_use_id"):
                results[block["tool_use_id"]] = block

    stamps = sorted(r["timestamp"] for r in records if r.get("timestamp"))
    sessions = sorted({r["sessionId"] for r in records if r.get("sessionId")})
    kinds = Counter(r.get("type") for r in records)
    shown = {"user", "assistant"}
    skipped = sorted((k, v) for k, v in kinds.items() if k not in shown)

    out = ["# Session transcript", ""]
    out.append(f"- **Session**: `{', '.join(sessions) or 'unknown'}`")
    if stamps:
        out.append(f"- **From**: {stamps[0]}")
        out.append(f"- **To**: {stamps[-1]}")
    out.append(f"- **Records**: {len(records)} ({kinds.get('user', 0)} user, "
               f"{kinds.get('assistant', 0)} assistant)")
    if skipped:
        detail = ", ".join(f"{count} {kind}" for kind, count in skipped)
        out.append(f"- **Not rendered**: {detail} (session bookkeeping, no message content)")
    out.append("")
    out.append("Generated by `transcript/render.py`. Unedited: every message and every tool "
               f"call with its result, in order. Tool results over {COLLAPSE_OVER} lines are "
               "folded into `<details>` blocks with their full text kept.")
    out.append("")
    out.append("---")
    out.append("")

    for record in records:
        kind = record.get("type")
        if kind not in shown:
            continue
        content = blocks_of(record)
        if not content:
            continue

        # A user record carrying only tool results is the other half of a tool
        # call, already rendered beneath it.
        if kind == "user" and all(b.get("type") == "tool_result" for b in content):
            continue

        time = clock(record)
        heading = "User" if kind == "user" else "Assistant"
        out.append(f"## {heading}" + (f" — {time}" if time else ""))
        out.append("")

        for block in content:
            block_type = block.get("type")
            if block_type == "text":
                out.append(block.get("text", ""))
                out.append("")
            elif block_type == "thinking":
                # Exports carry the block but not its text — the raw chain of
                # thought isn't returned. Note that the turn had one rather than
                # printing an empty code fence.
                thinking = block.get("thinking", "") or ""
                if thinking.strip():
                    out.append("*Thinking:*")
                    out.append("")
                    out.append(fence(thinking))
                else:
                    out.append("*Thinking: block present, no text in the export.*")
                out.append("")
            elif block_type == "tool_use":
                out.append(f"### Tool call: `{block.get('name', '?')}`")
                out.append("")
                out.append(render_tool_input(block.get("input")))
                out.append("")
                out.append(render_tool_result(results.get(block.get("id"))))
                out.append("")
            elif block_type == "tool_result":
                # A tool result sharing a record with real message content.
                out.append(render_tool_result(block))
                out.append("")
            else:
                out.append(fence(json.dumps(block, indent=2, ensure_ascii=False), "json"))
                out.append("")

        out.append("---")
        out.append("")

    return "\n".join(out)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IN
    target = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    records = read_records(source)
    markdown = render(records)
    with open(target, "w", encoding="utf-8") as handle:
        handle.write(markdown)
    print(f"{source} -> {target}: {len(records)} records, {markdown.count(chr(10)) + 1} lines")


if __name__ == "__main__":
    main()
