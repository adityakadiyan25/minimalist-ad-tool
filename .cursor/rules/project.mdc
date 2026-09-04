# Project rules — minimalist-ad-tool

Read this before doing anything in any session.

I'm building an internal tool for Minimalist (beminimalist.co) as part of a PM assignment. Two parts: an ad generator and an ad scorer. The people evaluating this care about judgment, not code. They've said outright that a nice-looking ad with a weak standard behind it fails.

So the priority is the rulebook and the scorer. The generator exists to prove the rulebook can actually be enforced.

## Scope — don't expand it

- Only build what I ask for in the current task. If you think something's missing, say so in one line and stop. Don't build it.
- One ad size: 1080x1080. No others.
- No image generation of any kind. Product images come from the product page, nowhere else.
- Scorer takes pasted text. No image upload, no OCR.
- India only — ASCI Code and Drugs & Cosmetics Rules. Don't pull in other countries' rules.
- No auth, no database, no dashboards, no animations. Not scored, not wanted.

## Facts — don't make them up

This is the one that matters most.

- Never invent a concentration, an ingredient, a claim, or a product detail. Every number in generated copy has to come from the structured data we pull from the product page.
- Never invent a regulatory citation. If you reference an ASCI clause or a D&C rule, it has to be quoted from a file in /evidence. If it's not there, say "not in evidence" and stop.
- Never invent a brand rule. Rules come from /prompts/rules.md, which I derived from what's in /evidence. If you think a rule is missing, propose it and say which evidence it would point to. Don't apply it.
- If you're not sure something is true, say you're not sure. Don't fill the gap with something that sounds right.

## Prompts

- Every prompt that goes to a model lives in /prompts as a plain file. Never inline one in a route handler or a component. The evaluators read these files.
- The scorer prompt applies rules by ID from /prompts/rules.md. It doesn't come up with its own criteria.
- Scorer output is JSON. For each rule: did it fire (true/false), the exact span of text, and a suggested fix.
- The model never decides severity. Severity comes from the rulebook.

## Code

- Commit after each meaningful change. The message should say what was decided, not which files changed.
- Never amend or rebase anything that's already been pushed.
- .env and keys never go in git. Check .gitignore before committing anything config-related.
- Server routes only for: fetching the product page, calling the model, proxying images. The API key never touches the client.

## When something's ambiguous

Say what's ambiguous. Propose one reading with a one-line reason. Wait for me. Don't quietly pick one and move on.
