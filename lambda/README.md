# NewsReal local pipeline

This was the AWS Lambda for the cron-driven NewsReal pipeline. It's now run
**locally** against an OpenAI-compatible inference server (LM Studio, Ollama,
vLLM, ...). The build/deploy scripts for AWS Lambda still exist (`npm run
build` / `npm run deploy`) but the EventBridge schedule is disabled and the
Anthropic API key has been removed — re-enable both before redeploying.

## Quick start

```bash
cd lambda
npm install
cp .env.example .env       # edit values for your inference server
npm run pipeline           # runs the full pipeline once, writes to DynamoDB
```

The live site (DynamoDB-backed) picks up changes on the next page load.

## Pipeline flow

`runFullPipeline()` in `src/handler.ts`. Steps in order:

| # | Step | What happens | Model |
|---|---|---|---|
| 1 | **Fetch feeds** | All RSS sources in parallel (AP, Reuters, Google News [general/world/biz/tech/science], Reddit, category feeds). | — |
| 2 | **Deduplicate** | Trigram cosine similarity + Jaccard. Tracks multi-source clusters for "X outlets reported this" UI. | — |
| 3 | **Article fetch** | Full article text via Readability. **Disabled by default** (`ENABLE_ARTICLE_FETCH` constant). | — |
| 4 | **Classify** | For each of ~150 selected items: `{category, bias_tag, manipulation_index, priority, quick_take}`. Floor of 25 per category × 6 categories (`politics, tech, finance, world, science, deep-state`). | `LOCAL_CLASSIFY_MODEL` |
| 5 | **Deep-analyze** | Per-story deep dive (mainstream framing / alt framing / follow-the-money / what's buried / etc.). Runs `DEEP_ANALYZE_COUNT` stories, parallel category streams. | `LOCAL_ANALYZE_MODEL` |
| 5b | **Bonus pass** | Re-classify + deep-analyze extra finance + science items (15 per category, hardcoded `BONUS_PER_CATEGORY`). | both |
| 6 | **Build Story objects** | Merge dedup cluster data ("3 outlets reported this") onto each story. | — |
| 7 | **Sidebar data** | One aggregated call producing: obfuscations, narratives, ticker, suppressed searches. **Large prompt — needs ample model context window.** | `LOCAL_ANALYZE_MODEL` |
| 7b | **Narrative deep dives** | One analysis per narrative the sidebar step emitted. | `LOCAL_ANALYZE_MODEL` |
| 7c | **Search analyses** | For each curated search query: live RSS fetch + per-query summary. **Also large prompts.** | `LOCAL_ANALYZE_MODEL` |
| 8 | **Write stories** | One `PutItem` per story into the `newsreal-stories` DDB table. | — |
| 9 | **Write cache** | Sidebar/manifest/analyses into the `newsreal-cache` DDB table under fixed keys. | — |

### DynamoDB keys the site reads

- `homepage-manifest` — ordered list of slugs (story grid order)
- `homepage-narratives` / `homepage-obfuscations` / `homepage-ticker` / `homepage-suppressed`
- `homepage-narrative-analyses` / `homepage-search-analyses`
- `homepage-bonus-finance` / `homepage-bonus-science`
- `narrative-analysis:{slug}` — per-narrative deep dive
- `pipeline-last-run` — timestamp
- All cache entries have TTL = 12 hours.

## Tuning knobs (`.env`)

| Var | Default | Notes |
|---|---|---|
| `LLM_BASE_URL` | `http://localhost:1234/v1` | LM Studio. Ollama: `http://localhost:11434/v1`. |
| `LOCAL_CLASSIFY_MODEL` | `nemotron-3-nano-omni` | Light model — short outputs. |
| `LOCAL_ANALYZE_MODEL` | `gemma4-31b` | Heavier model — long outputs, big prompts. Can be the same as classify. |
| `CLASSIFY_COUNT` | `120` | Floored at 150 (25 × 6 cats) regardless. Setting below 150 has no effect. |
| `DEEP_ANALYZE_COUNT` | `120` | Set to `0` to skip Step 5 entirely (Step 5b still runs). |
| `CLASSIFY_BATCH_SIZE` | `10` | Concurrent classify calls. Set to `1` for LM Studio (no continuous batching). |
| `ANALYZE_BATCH_SIZE` | `5` | Same. |
| `CLASSIFY_MAX_TOKENS` | `4096` | Reasoning models burn tokens thinking; bump higher if classification JSON gets truncated. |
| `ANALYZE_MAX_TOKENS` | `8192` | Same. |
| `NEWSREAL_AWS_REGION` | — | Required. Credentials come from `~/.aws/credentials` default chain unless `NEWSREAL_AWS_ACCESS_KEY_ID` / `NEWSREAL_AWS_SECRET_ACCESS_KEY` are also set. |

Hardcoded (not yet env-tunable):
- `BONUS_PER_CATEGORY = 15` — items per bonus category
- `BONUS_CATEGORIES = ['finance', 'science']`
- Per-category classification floor of 25 inside `selectForClassification`

## Troubleshooting

**`Failed to parse classification: { ... [truncated]`**
The model ran out of `max_tokens` mid-output. Reasoning models (Nemotron Nano,
DeepSeek-R1, etc.) burn most of their token budget on internal reasoning
before emitting the JSON. Bump `CLASSIFY_MAX_TOKENS` (e.g. to `8192`) or
switch to a non-reasoning model for classification.

**`400 Context size has been exceeded.`**
The analyze model's loaded context window is smaller than the prompts the
sidebar / search / narrative steps build. Reload the analyze model in LM
Studio with `Context Length` set to at least 16K (32K recommended for the
full pipeline).

**Pipeline runs forever**
Each LM Studio request serializes through one loaded model. Concurrency
won't help. Reduce `DEEP_ANALYZE_COUNT` to limit Step 5, and tolerate the
hardcoded ~150 classify + 30 bonus items. Total runtime scales roughly
linearly with `(classify_count × classify_latency) + (analyze_count ×
analyze_latency)`.

**LM Studio uses too much RAM**
LM Studio retains models in memory across requests. After hitting both
`LOCAL_CLASSIFY_MODEL` and `LOCAL_ANALYZE_MODEL` it will hold both. Check
loaded state with:
```bash
curl -s http://localhost:1234/api/v0/models | jq '.data[] | {id, state}'
```
Enable "Auto-unload unused models" in LM Studio's server settings if memory
pressure is a problem.

## Files

- `src/handler.ts` — the whole pipeline (`runFullPipeline`), AWS Lambda
  entry point (`handler`), and every helper. Single file by design.
- `src/local.ts` — local entry point. Loads `.env`, calls
  `runFullPipeline()`, prints stats.
- `.env.example` — config template.

## Re-enabling the AWS schedule

If you ever want to put this back on EventBridge:

```bash
# Restore Anthropic key in Lambda env, then:
aws events enable-rule --name newsreal-ingest-news
# Optionally re-enable the analyze rule too — but note runFullPipeline()
# already does both classify and analyze, so newsreal-analyze is redundant.
```

You'll also need to put `ANTHROPIC_API_KEY` back in the Lambda environment
(and swap the OpenAI SDK back to Anthropic SDK in `src/handler.ts` — the git
history has the prior version).
