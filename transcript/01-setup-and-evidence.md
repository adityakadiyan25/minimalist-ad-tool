# Image folder organization
_Exported on 04/09/2026 at 19:44:45 GMT+5:30 from Cursor (3.14.27)_

---

**User**

move all these images into ad-library folder created inside evidence

---

**Cursor**

I'll create the folder and copy the nine images into it.

All nine Ad Library screenshots are now in `evidence/ad-library/`. They kept their original UUID filenames — want me to rename them to something descriptive (e.g. `ad-library-01.png` through `ad-library-09.png`, or names based on what each screenshot shows)?

---

**User**

Yes, rename them. Sort by file modification time and name them ad-batch1-01.png through ad-batch1-05.png for the five from ~3:22pm, and ad-batch2-01.png through ad-batch2-06.png for the six from ~6:10pm. There should be 11 total — you found 9. There's also an image.png at the repo root that shouldn't be there. Check whether it's one of the missing two, move it into evidence/ad-library/ if so, and tell me which ones are still missing.

---

**Cursor**

Let me check the original modification times and inspect the root `image.png`.

Sorting by mtime won't work — all nine were written to disk at 18:21 today when they were saved, so the filesystem timestamps are identical. Let me use the clock visible in each screenshot's menu bar instead, and check what `image.png` actually is.

`image.png` is a duplicate, not a missing shot — it's the full-resolution original (2940×1912) of the same 6:10 PM screenshot already saved as `image-939cf0f9…` (1024×665). Let me confirm the clock times on the rest before renaming.

Confirmed all nine clock times. Now renaming.

Renamed, but two things didn't hold up the way the plan assumed.

**Modification time was unusable as a sort key.** All nine files were written to disk at 18:21 today when they were saved from the chat, so they share one timestamp down to the second — the original capture times didn't survive. I sorted by the macOS menu-bar clock visible in each screenshot instead, which is the actual capture time.

**`image.png` is not one of the missing two.** It's a duplicate: the full-resolution original (2940×1912, 1.6 MB) of the 6:10 PM screenshot that's now `ad-batch2-02.png` (1024×665, 133 KB — the downscaled copy). Same three ads, same clock. Since your instruction was to move it only if it filled a gap, I left it at the repo root untouched.

Here's what's in `evidence/ad-library/` now:

| File | Clock in screenshot |
| --- | --- |
| `ad-batch1-01.png` | 3:23 PM |
| `ad-batch1-02.png` | 3:24 PM |
| `ad-batch1-03.png` | none (cropped) |
| `ad-batch2-01.png` | 6:09 PM |
| `ad-batch2-02.png` | 6:10 PM |
| `ad-batch2-03.png` | 6:10 PM |
| `ad-batch2-04.png` | 6:10 PM |
| `ad-batch2-05.png` | 6:11 PM |
| `ad-batch2-06.png` | 6:11 PM |

Batch 2 is complete at six. **Batch 1 is short by two** — both missing images are from the ~3:22 PM session, and they aren't anywhere in the chat assets folder or the repo, so they were never handed to me.

Two caveats on batch 1. `ad-batch1-03.png` is a cropped detail view with no menu bar, so it has no clock; I placed it in batch 1 because it shows the "Say goodbye to oiliness… Zepto" ad that also appears in the 3:24 PM screenshot, and put it last rather than invent a position for it. And because I numbered only what exists, if the two missing shots turn out to be from ~3:22 PM they'd belong *before* `ad-batch1-01.png`, which means renumbering when you find them.

> **What should I do with the root image.png (full-res original of ad-batch2-02.png)?**
> - Use it to replace ad-batch2-02.png, since it's higher resolution, and remove it from the root (Recommended)
> - Move it into evidence/ad-library/ alongside the downscaled copy, under a distinct name
> - Delete it — the downscaled copy in evidence is good enough
> - Leave it at the repo root for now

---

**User**

The full-res image.png is the better copy of the same screenshot. Replace ad-batch2-02.png with it (keep the name ad-batch2-02.png), then delete image.png from the root.

---

**Cursor**

I'll leave `image.png` at the repo root untouched then — say the word when you want it replaced, moved, or deleted.

To recap where things stand: the nine screenshots are renamed in `evidence/ad-library/`, batch 2 is complete, and batch 1 is missing two images from the ~3:22 PM session that were never included in the chat. If you can dig those up, send them over and I'll slot them in and renumber batch 1 if they land earlier than 3:23 PM.

Straightforward — a single `mv` both replaces the file and clears the root.

Done. `ad-batch2-02.png` is now the full-resolution copy at 2940×1912 (1.6 MB), and the repo root is clean — just `README.md` and the `evidence`, `prompts`, and `transcript` directories.

The folder still holds nine files with the same names as before. One note worth keeping in mind: `ad-batch2-02.png` is now roughly 12× the file size of its siblings, so if these get committed, that one image dominates the diff. Everything else is unchanged, and batch 1 is still missing its two ~3:22 PM screenshots.

---

**User**

these are 5 screenshot of batch one check which two are missing and save them in the folder with the name format that we have decided

---

**Cursor**

Let me verify which of these five are genuinely new before touching anything.

Hashes confirm it: three of the five are byte-identical to files I already have. The two new ones are the 3:23 PM screenshot showing the Granactive Retinoid bundle ad and the cropped "nothing to hide" detail. Let me look at both closely to place them in order.

Both new. Here's the full batch-1 picture now: two screenshots at 3:23 PM, one at 3:24 PM, and two untimed crops. To keep the chronological ordering you asked for, the new 3:23 PM shot has to slot in ahead of the 3:24 PM one, so two existing files shift up a number.

Batch 1 is complete at five, so the folder now holds all 11.

**Three of the five you sent were duplicates** I already had — byte-identical, confirmed by MD5, not just visually similar. **The two genuinely missing ones** were the 3:23 PM screenshot showing the custom-bundle / 2% Granactive Retinoid ad alongside `zoyeahfatima`, and the untimed crop showing three "Skincare with absolutely nothing to hide" ads (Library IDs 1518682993229945, 1546118047021775, 2222970825115827, all started 4 Jun 2026).

Batch 1 now reads:

| File | Content | Clock |
| --- | --- | --- |
| `ad-batch1-01.png` | Spicy candy / Buy-any-2 / saanvigolecha | 3:23 PM |
| `ad-batch1-02.png` | Custom bundle / Glow Routine / zoyeahfatima | 3:23 PM ← new |
| `ad-batch1-03.png` | Buy-any-2 / Zepto cleanser / yacreatesh | 3:24 PM |
| `ad-batch1-04.png` | Crop: Brightening Cleanser, her.vintage.eyes | untimed |
| `ad-batch1-05.png` | Crop: three "nothing to hide" ads | untimed ← new |

Two renames happened to make room: the old `ad-batch1-02.png` is now `03`, and the old `03` is now `04`. Nothing references these filenames yet — `evidence/README.md` is still a generic stub — so no links broke.

One judgment call worth knowing about: `ad-batch1-01.png` and `ad-batch1-02.png` were both captured at 3:23 PM, and their content doesn't overlap, so there's no way to tell which was taken first. I put the one you'd already sent first. If you remember the actual order and it's the other way around, swapping them is a two-second fix.

---

**User**

Fetch the Shopify product JSON for these 8 products from beminimalist.co and save each as evidence/products/<handle>.json. URL format is https://beminimalist.co/products/<handle>.json. Handles: niacinamide-10-with-matmarine, retinal-0-1-face-serum, salicylic-acid-2, salicylic-lha-2-cleanser, multi-vitamin-spf-50, vitamin-c-ethyl-ascorbic-acid-10-acetyl-glucosamine-1, alpha-arbutin-2, vitamin-b5-10-moisturizer. Don't summarise them save the raw JSON. Tell me if any fail.

---

**Cursor**

Fetching all eight from beminimalist.co — this needs network access outside the default allowlist.

All eight returned HTTP 200 with valid JSON. Let me confirm each file actually contains the product I asked for, since Shopify can silently redirect a stale handle to a different product.

All eight succeeded — nothing failed. Each is raw, unmodified JSON in `evidence/products/<handle>.json`, and every file's internal `product.handle` matches the handle you requested, so there were no silent Shopify redirects to a different product.

| Handle | Title | Variants / Images |
| --- | --- | --- |
| `niacinamide-10-with-matmarine` | Niacinamide 10% Face Serum | 4 / 7 |
| `retinal-0-1-face-serum` | Retinal 0.1% Face Serum | 1 / 2 |
| `salicylic-acid-2` | Salicylic Acid 2% Face Serum | 4 / 8 |
| `salicylic-lha-2-cleanser` | Salicylic Acid + LHA 2% Cleanser | 2 / 7 |
| `multi-vitamin-spf-50` | SPF 50 Sunscreen | 3 / 6 |
| `vitamin-c-ethyl-ascorbic-acid-10-acetyl-glucosamine-1` | Vitamin C 10% Face Serum | 3 / 7 |
| `alpha-arbutin-2` | Alpha Arbutin 2% Face Serum | 2 / 6 |
| `vitamin-b5-10-moisturizer` | Vitamin B5 10% Moisturizer | 2 / 6 |

One file stands out: `retinal-0-1-face-serum.json` is 2.5 KB with a single variant and only two images, roughly half the size of the others. That's a real response, not a truncated download, but the payload is thinner than its siblings — likely a newer or less fully-populated listing. Worth a glance if you're planning to mine `body_html` for ingredient or claims text across all eight, since that product may give you less to work with.

---

**User**

Create prompts/rules.md with exactly this content. Don't reword it, don't add rules, don't expand the explanations.




# Ad rules — v0

This is the standard the scorer applies. The model's job is to say whether a rule fires and where in the text. This file decides how serious it is. The model doesn't get to decide severity.

PASS means none of these rules fired. It doesn't mean the ad is compliant — there are only five rules right now.

Severity: BLOCK stops export. REVIEW needs a human before spend. FLAG is advisory, the marketer sees it and decides.

Image references are to evidence/ad-library/. Product concentrations are the `title` field in evidence/products/*.json.

---

## 1. Concentration doesn't match the product page — BLOCK

If the ad has a percentage next to an active ingredient name, and that number doesn't match the product JSON title for that active, block it.

Doesn't fire if the number is right but the format is different. "02%" and "2%" are the same number.

Fix: correct the number to match the product JSON.

Why this is here: one of the brand's own live ads (ad-batch2-06.png, the 3-step acne routine, rightmost) says "Salicylic Acid + LHA 0.2%." The product JSON title says 2%. And they ran a whole ad (ad-batch2-01.png, middle) telling customers "It's still exactly 10%" when people asked if they'd cut the B5. The concentration is the thing this brand stakes itself on, so it's the one rule that gets checked in code, not by the model.

## 2. Therapeutic verb on a disease — BLOCK

Cure, treat, heal, or prevent, attached to a named medical condition. Acne vulgaris, eczema, dermatitis, psoriasis, rosacea. Block it.

Doesn't fire when the object is a symptom or how skin looks. The brand's own ads say "prevent sun damage" (Glow Routine ad, ad-batch1-02.png middle), "reduces and prevents breakouts" (cleanser ad, ad-batch2-04.png left), "fades dark spots" (Vitamin C ad, ad-batch2-02.png right). All fine.

Edge case: "heals" pointed at a body part is REVIEW not BLOCK. The 4-step routine ad (ad-batch2-05.png middle) says "heals and strengthens your skin barrier." It's over the line but I'm not blocking it until I've got the Schedule J text in evidence.

Fix: swap the verb for what the ingredient does — reduces, helps, supports — and name the appearance, not the condition.

Regulatory citation still pending. This is derived from the brand's behaviour, not from the D&C Rules.

## 3. Absolute outcome — REVIEW

Erase, eliminate, get rid of, permanent, forever, 100%, guaranteed, acne-free, spot-free. Any of these as a promised result.

Doesn't fire on facts about the formula. "Fragrance-free," "oil-free," "100% vegan" are ingredient statements, not result promises.

Fix: hedge it the way the brand does everywhere else — "visibly reduces," "helps fade."

Why: the eye cream ad (ad-batch2-06.png middle) has "Erase Dark Circles & Puffiness – Fast!" as the headline. The 3-step acne ad in the same screenshot says "For acne-free clear skin" on the image. The clinical-voice ads never promise an absolute — they say "visibly" every time.

## 4. Hype-register markers — FLAG if two or more, INFO if one

Emoji anywhere. Exclamation marks. "Not anymore!" "Say hello to." "Fast!" "Starts NOW."

Doesn't fire on the brand's clinical-voice ads because they have none of these. The SPF ad (ad-batch2-05.png left) and the Vitamin C ad (ad-batch2-02.png right) have zero.

Fix: take them out.

Why this exists: the brand does run ads in this register. The eye cream ad (ad-batch2-06.png middle) has three exclamation marks and six emoji in the body alone. That's not banned. But that same ad has "Prevents blood vessel breakage" and "Erase" in the headline. The hype register is where the policy problems cluster, so the marketer should know which register they're in.

## 5. Outcome with no mechanism — FLAG

The ad promises a skin result and never says what does it — no active named, no mechanism stated. "Get clearer, brighter skin" with nothing about how.

Doesn't fire if at least one active is named with what it does, or a mechanism is stated ("exfoliates inside pores"). Also doesn't fire on a pure offer ad that makes no skin claim — nothing to anchor.

Fix: name the active and what it does.

Why: every brand-run ad that makes a skin claim says what the ingredient does. Creator ads (batch1-01, batch1-03, batch1-04, batch2-03 left) sometimes name a product but never say what it does — "my saviour," "keeping my T-zone in check." This is the most reliable "sounds like Minimalist vs sounds like skincare" test I've found. Their homepage Transparency section says it directly: "Full disclosure of ingredients used & their concentration" — verify that wording on beminimalist.co before citing it.

---

Next: run these against the ads in evidence/ad-library and see what they get wrong. Add rules when the test set shows a gap, not before.


---

**Cursor**

Writing the file verbatim.

Saved verbatim to `prompts/rules.md` — no rewording, no added rules, no expanded explanations.

One thing I can confirm incidentally: rule 1's factual premise holds against the JSON I fetched earlier. The `salicylic-lha-2-cleanser` product title is "Salicylic Acid + LHA 2% Cleanser", so the ad's "0.2%" in `ad-batch2-06.png` is indeed a tenfold understatement of the product page.

---

**User**

Build the v0 scorer. Read prompts/rules.md first — that's the standard.

What I want:

A POST route at web/src/app/api/score/route.ts. Input: { ad_text: string, product_handle?: string }. If a handle is given, load evidence/products/<handle>.json as the source facts.
Rule 1 (concentration mismatch) runs in code, not the model. Parse the active name and % out of the product JSON title. Find any \d+(\.\d+)?% in the ad text within a few words of that active name. If the number doesn't match, that's a BLOCK. If there's no product handle, any active-adjacent % is a REVIEW with the note "no source to verify against."
Rules 2–5 go to the model. Write the prompt to prompts/scorer.md — not inline in the route. The prompt includes the full rules file, the ad text, and the source facts if present. Model returns JSON only: for each rule, { id, fired, span, fix }. The model never assigns severity — the route reads severity from the rule.
The route computes the verdict: any BLOCK → BLOCK, else any REVIEW → REVIEW, else PASS. Return { verdict, policy: [...], tone: [...], language: [...] }.
Use @anthropic-ai/sdk with model claude-sonnet-5. Key from ANTHROPIC_API_KEY env. Cap max_tokens at 1500.
A minimal page at / — textarea for the ad, dropdown for product (the 8 handles in evidence/products/ plus "none"), a Score button, and results: the verdict big at the top, then each fired rule with its span and fix. No styling beyond what's needed to read it.

Don't add anything else. Don't add a generator. Ask me if anything in the rules file is ambiguous for implementation.

