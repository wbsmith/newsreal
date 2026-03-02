# PARANOIA METRICS — How We Score the Machine

## Philosophy

Every news article is a product. Someone paid for it. Someone approved it.
Someone decided what to include and — more importantly — what to leave out.

The Paranoia Metrics quantify this. Not with vibes. Not with a model picking
a number out of thin air. With a structured, dimensional rubric that forces
the AI to justify every point.

Two systems. One measures how hard a single article is trying to manipulate
you. The other measures how synchronized the messaging is across outlets —
because when six newsrooms publish the same take with the same words on the
same morning, that's not journalism. That's a memo.

---

## I. THE MANIPULATION INDEX

**What it measures:** How much a piece of coverage is engineered to steer the
reader toward a predetermined conclusion rather than inform them.

**Score range:** 0-100 (sum of 5 dimensions, each scored 0-20)

**Input:** Full article text when available (fetched via Readability extraction),
falling back to headline + RSS snippet. The model is told which it has and
adjusts confidence accordingly.

### Dimension 1: EMOTIONAL MANIPULATION (0-20)

Is the language designed to make you feel something before you think something?

| Range | What it looks like |
|-------|-------------------|
| 0-5   | Clinical, neutral tone. Facts stated without adjectives. AP wire energy. |
| 6-10  | Some charged words but the backbone is factual. A lean, not a shove. |
| 11-15 | Frequent emotional triggers — urgency, outrage, fear. "SHOCKING new report." Identity-group appeals. Tweaked quotes for maximum heat. |
| 16-20 | Rage-bait. Every sentence is an emotional hook. Reads like a fundraising email cosplaying as news. |

**What to look for:** Fear words, urgency markers (BREAKING, SHOCKING, ALARMING),
appeals to tribal identity, emotionally-loaded verb choices ("slammed" vs "criticized"),
exclamation points in headlines.

### Dimension 2: SOURCE TRANSPARENCY (0-20)

Can you check their homework?

| Range | What it looks like |
|-------|-------------------|
| 0-5   | Named sources, linked documents, verifiable data points. You could fact-check this in 10 minutes. |
| 6-10  | Mix of named and unnamed. Most claims are checkable but a few key ones aren't. |
| 11-15 | Critical claims rest on "officials say" / "experts warn" / "sources familiar with the matter." You're asked to trust the journalist's rolodex. |
| 16-20 | Major assertions floating free. No attribution, or circular sourcing (Outlet A cites Outlet B which cites Outlet A). Faith-based reporting. |

**What to look for:** Attribution density. Named vs unnamed source ratio. Whether
data claims link to primary sources or just other articles. "Studies show" without
naming the study.

### Dimension 3: FRAMING BIAS (0-20)

How hard is the piece pushing you toward one interpretation?

| Range | What it looks like |
|-------|-------------------|
| 0-5   | Multiple perspectives. Counter-evidence acknowledged. Reader trusted to conclude. |
| 6-10  | Discernible lean but opposing views get airtime. You can detect the bias but it's not insulting your intelligence. |
| 11-15 | Single-frame narrative. Counter-arguments strawmanned or buried in paragraph 19. Hero/villain roles pre-assigned. |
| 16-20 | Pure advocacy wearing a press badge. One interpretation presented as the only sane position. Dissent framed as fringe/dangerous. |

**What to look for:** Paragraph order (who gets quoted first and last), adjective
asymmetry (one side "argues" while the other "claims"), whether counter-evidence
is addressed or simply absent, false balance masking a strong lean.

### Dimension 4: SELECTIVE OMISSION (0-20)

What would change your mind if they'd told you?

| Range | What it looks like |
|-------|-------------------|
| 0-5   | Context-rich. Financial ties disclosed. Historical precedent noted. Counter-evidence included. |
| 6-10  | Minor gaps. Nothing that flips the narrative, just incomplete around the edges. |
| 11-15 | Significant context missing — campaign contributions, lobbying connections, timing relative to other events, relevant regulatory history. The gaps form a pattern. |
| 16-20 | Critical information absent that would materially change the reader's conclusion. Feels deliberate. |

**What to look for:** Follow the money — is funding disclosed? Timing — what else
happened that day? History — has this exact play run before? Conflicts of interest
in quoted experts. Relevant court filings, SEC disclosures, or Federal Register
entries that contextualize the story.

### Dimension 5: HEADLINE ACCURACY (0-20)

Does the sign on the door match what's inside?

| Range | What it looks like |
|-------|-------------------|
| 0-5   | Headline is a fair, accurate summary of the article. |
| 6-10  | Slight emphasis shift or exaggeration. Defensible but optimized for clicks. |
| 11-15 | Headline implies causation the article doesn't support, or overstates certainty of tentative findings. |
| 16-20 | Headline is actively misleading. Article buries the lede or contradicts its own title. Pure clickbait. |

**What to look for:** Compare headline claim to article evidence. "X LINKED TO Y"
when article says "researchers are exploring a possible connection." Question marks
in headlines used to assert without asserting.

**Note:** This dimension is scored with low confidence when only headline + snippet
are available (no full article text). The model is instructed to flag this.

---

## II. NARRATIVE COHERENCE INDEX

**What it measures:** How synchronized the messaging is across multiple outlets
covering the same story or theme. High coherence = coordinated narrative. Low
coherence = healthy, independent journalism.

**Score range:** 0-100 (sum of 4 dimensions, each scored 0-25)

**Input:** The set of headlines and article text from multiple outlets covering
the same narrative thread, as identified by the pipeline's narrative detection.

### Dimension 1: LEXICAL ALIGNMENT (0-25)

Are they using the same words?

| Range | What it looks like |
|-------|-------------------|
| 0-8   | Same topic, different language. Normal independent coverage. |
| 9-16  | Shared terminology but distinct framing. Some key phrases repeat but writing is original. |
| 17-25 | Near-identical phrasing across outlets. Same metaphors, same adjectives, same sentence structures. Someone sent a memo. |

**What to look for:** Repeated phrases that aren't proper nouns or technical terms.
Same unusual adjective appearing in 4+ outlets. Identical framing constructions.

### Dimension 2: FRAME UNIFORMITY (0-25)

Are they telling the same story?

| Range | What it looks like |
|-------|-------------------|
| 0-8   | Diverse interpretations. Same events, different conclusions. |
| 9-16  | Similar conclusions but different reasoning paths. Convergent but not coordinated. |
| 17-25 | Uniform narrative arc. Same heroes, same villains, same prescribed audience response. Interchangeable articles. |

**What to look for:** Who is cast as protagonist/antagonist across outlets.
Whether the "solution" or "response" suggested is uniform. Whether the same
historical parallels are drawn.

### Dimension 3: SOURCE CONVERGENCE (0-25)

Are they all calling the same people?

| Range | What it looks like |
|-------|-------------------|
| 0-8   | Diverse sourcing. Different experts, different data sets. |
| 9-16  | Some overlap in key sources but each outlet adds unique voices. |
| 17-25 | Same 2-3 experts quoted everywhere. Same study cited as if it's the only one. Same spokesperson's framing adopted wholesale. |

**What to look for:** Repeated expert names across outlets. Single-study coverage
where alternatives exist. PR firm fingerprints (identical quotes, suspiciously
polished data points).

### Dimension 4: COUNTER-NARRATIVE ABSENCE (0-25)

Is anyone breaking ranks?

| Range | What it looks like |
|-------|-------------------|
| 0-8   | Healthy dissent. Multiple outlets pushing back, offering alternative frames. |
| 9-16  | Some dissent but it's minority, muted, or hedged. |
| 17-25 | Near-total uniformity. No major outlet questioning the dominant frame. Skeptics either absent or pre-labeled as fringe. |

**What to look for:** Whether any mainstream outlet breaks from the pack. Whether
dissent is presented as legitimate disagreement or pre-dismissed. Whether the
Overton window has been narrowed to exclude obvious questions.

---

## Implementation

### Article Fetching

For the 120 articles selected for classification, the pipeline fetches the full
article text using Mozilla's Readability algorithm (the same engine behind
Firefox Reader Mode). This strips navigation, ads, and chrome, leaving just the
article body.

- **Concurrency:** 20 parallel fetches
- **Timeout:** 10 seconds per article
- **Fallback:** When a fetch fails (paywall, bot detection, timeout), the pipeline
  falls back to the RSS snippet. The model is told whether it has full text or
  snippet-only, and adjusts confidence accordingly.

### Prompt Structure

The model receives the rubric inline and must output each sub-score with a
one-sentence justification before computing the total. This prevents
"number vibing" — every point must be earned.

```json
{
  "manipulation_scores": {
    "emotional_manipulation": { "score": 14, "reason": "..." },
    "source_transparency": { "score": 8, "reason": "..." },
    "framing_bias": { "score": 16, "reason": "..." },
    "selective_omission": { "score": 12, "reason": "..." },
    "headline_accuracy": { "score": 6, "reason": "..." }
  },
  "manipulation_index": 56,
  "has_full_text": true
}
```

### What This Replaces

Previously, both indices were "vibed" — the model received
`"manipulation_index": <0-100>` and `"coherence_score": <0-100>` with no rubric,
no dimensions, no justification. The model picked a number. The same article
could score 40 one hour and 75 the next.

The dimensional approach produces:
- **Reproducible** scores (same article -> similar score across runs)
- **Explainable** scores (you can see WHY it scored high)
- **Calibrated** scores (a 70 means something specific)
- **Debuggable** scores (if a dimension seems off, you can tune that dimension's rubric)
