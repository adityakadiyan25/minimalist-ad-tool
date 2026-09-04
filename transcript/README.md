# Transcript

Agent session exports, numbered in order. Unedited, including sessions that went badly.

Cursor sessions are exported through the Cursor UI. Claude Code desktop sessions are
copied raw out of `~/.claude/projects/` as JSONL and rendered to markdown with
`render.py` — `python3 transcript/render.py <in.jsonl> <out.md>`, which defaults to the
02 session.

The JSONL export carries the user messages, the assistant messages, and every tool call
with its result. It does not carry the model's thinking text: the thinking blocks are in
the export but empty, so the rendered markdown notes each one and has nothing to show.
