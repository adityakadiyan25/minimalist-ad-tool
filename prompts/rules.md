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

## 2a. Therapeutic verb on a named condition — BLOCK

Cure, treat, heal, or prevent, attached to a named medical condition. Acne vulgaris, eczema, dermatitis, psoriasis, rosacea. Block it.

Doesn't fire when the object is a symptom or how skin looks. The brand's own ads say "prevent sun damage" (Glow Routine ad, ad-batch1-02.png middle), "reduces and prevents breakouts" (cleanser ad, ad-batch2-04.png left), "fades dark spots" (Vitamin C ad, ad-batch2-02.png right). All fine.

Fix: swap the verb for what the ingredient does — reduces, helps, supports — and name the appearance, not the condition.

Regulatory citation still pending. This is derived from the brand's behaviour, not from the D&C Rules.

## 2b. Therapeutic verb on a body part — REVIEW

Same verbs, but the object is a body part or a structure in the skin rather than a named condition. The 4-step routine ad (ad-batch2-05.png middle) says "heals and strengthens your skin barrier." It's over the line but I'm not blocking it until I've got the Schedule J text in evidence.

Split out from 2a rather than left as an edge case inside it, because the scorer reads severity from this file by rule ID. One ID can't carry two severities.

Fix: same as 2a.

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


