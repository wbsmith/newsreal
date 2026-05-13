import 'dotenv/config';
import {
  fetchAllFeeds,
  deduplicateStories,
  selectForClassification,
  classifyStory,
  classifyStats,
  resetClassifyStats,
} from './handler.js';
import { countStories } from './local-store.js';

// Test config. Override via env. Skips Steps 5-9 entirely — pure classification benchmark.
const TEST_COUNT = Number(process.env.TEST_COUNT ?? 60);
const PER_CATEGORY = Number(process.env.TEST_PER_CATEGORY ?? 10);

interface Sample {
  headline: string;
  source: string;
  category: string;
  biasTag: string;
  manipIdx: number;
  priority: string;
  quickTake: string;
  tier: 'cache' | 'slim-LLM' | 'full-LLM' | 'no-result';
  ms: number;
}

async function main() {
  const t0 = Date.now();
  console.log('━━━ Classification test ━━━');
  const corpus = countStories();
  console.log(`Local corpus: ${corpus.total} stories (${corpus.withEmbedding} with embeddings)`);
  console.log(`Will fetch fresh RSS, dedup, classify ${TEST_COUNT} items via the tiered classifier.`);
  console.log('');

  console.log('Step 1: Fetching RSS feeds...');
  const t1 = Date.now();
  const { items, sourceErrors } = await fetchAllFeeds();
  console.log(`  ${items.length} items, ${sourceErrors} source errors, ${((Date.now() - t1) / 1000).toFixed(1)}s`);

  console.log('Step 2: Deduplicating...');
  const t2 = Date.now();
  const { unique, duplicates } = deduplicateStories(items);
  console.log(`  ${unique.length} unique (${duplicates} dupes), ${((Date.now() - t2) / 1000).toFixed(1)}s`);

  console.log('Step 3: Selecting for classification...');
  const toClassify = selectForClassification(unique, TEST_COUNT, PER_CATEGORY);
  console.log(`  ${toClassify.length} selected`);

  resetClassifyStats();

  console.log('');
  console.log(`Classifying ${toClassify.length} stories...`);
  console.log('');

  const samples: Sample[] = [];
  // Capture per-call tier by snapshotting stats before/after each call.
  let prevCache = 0, prevSlim = 0, prevFull = 0;

  for (let i = 0; i < toClassify.length; i++) {
    const item = toClassify[i];
    const tCall = Date.now();
    const result = await classifyStory(item);
    const ms = Date.now() - tCall;

    let tier: Sample['tier'] = 'no-result';
    if (classifyStats.cacheHits > prevCache) tier = 'cache';
    else if (classifyStats.slimLLMCalls > prevSlim) tier = 'slim-LLM';
    else if (classifyStats.fullLLMCalls > prevFull) tier = 'full-LLM';
    prevCache = classifyStats.cacheHits;
    prevSlim = classifyStats.slimLLMCalls;
    prevFull = classifyStats.fullLLMCalls;

    if (result) {
      samples.push({
        headline: item.title,
        source: item.source,
        category: result.category,
        biasTag: result.bias_tag,
        manipIdx: result.manipulation_index,
        priority: result.priority,
        quickTake: result.quick_take,
        tier,
        ms,
      });
    }

    process.stdout.write(`\r  ${i + 1}/${toClassify.length} (cache: ${classifyStats.cacheHits}, slim: ${classifyStats.slimLLMCalls}, full: ${classifyStats.fullLLMCalls})`);
  }
  process.stdout.write('\n');

  // Summary
  console.log('');
  console.log('━━━ Results ━━━');
  console.log(`Stats: cache=${classifyStats.cacheHits}  slim-LLM=${classifyStats.slimLLMCalls}  full-LLM=${classifyStats.fullLLMCalls}  embed-fail=${classifyStats.embedFailures}`);

  const total = samples.length || 1;
  const tiers: Record<string, { count: number; totalMs: number }> = { 'cache': { count: 0, totalMs: 0 }, 'slim-LLM': { count: 0, totalMs: 0 }, 'full-LLM': { count: 0, totalMs: 0 }, 'no-result': { count: 0, totalMs: 0 } };
  for (const s of samples) {
    tiers[s.tier].count++;
    tiers[s.tier].totalMs += s.ms;
  }
  console.log('');
  console.log(`Tier breakdown (% of classified, avg latency):`);
  for (const [tier, { count, totalMs }] of Object.entries(tiers)) {
    if (count === 0) continue;
    const pct = ((count / total) * 100).toFixed(1);
    const avg = (totalMs / count).toFixed(0);
    console.log(`  ${tier.padEnd(10)} ${String(count).padStart(4)}  ${pct.padStart(5)}%   avg ${avg}ms`);
  }
  console.log('');
  console.log(`Total wall clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Print 10 random samples so user can eyeball quality
  console.log('');
  console.log('━━━ Sample classifications (random 10) ━━━');
  const sampleIdx = new Set<number>();
  while (sampleIdx.size < Math.min(10, samples.length)) {
    sampleIdx.add(Math.floor(Math.random() * samples.length));
  }
  for (const i of sampleIdx) {
    const s = samples[i];
    console.log(`\n[${s.tier}] (${s.ms}ms)`);
    console.log(`  source: ${s.source}`);
    console.log(`  headline: ${s.headline}`);
    console.log(`  cat=${s.category}  bias=${s.biasTag}  manip=${s.manipIdx}  priority=${s.priority}`);
    console.log(`  quick: ${s.quickTake}`);
  }
}

main().catch((err) => {
  console.error('Classify test failed:', err);
  process.exit(1);
});
