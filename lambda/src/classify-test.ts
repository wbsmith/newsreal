import 'dotenv/config';
import {
  fetchAllFeeds,
  deduplicateStories,
  selectForClassification,
  assessStory,
} from './handler.js';
import { countStories } from './local-store.js';

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
  ms: number;
}

async function main() {
  const t0 = Date.now();
  console.log('━━━ Assess test ━━━');
  const corpus = countStories();
  console.log(`Local corpus: ${corpus.total} stories (${corpus.withEmbedding} with embeddings)`);
  console.log(`Will fetch fresh RSS, dedup, assess ${TEST_COUNT} items.`);
  console.log('');

  console.log('Step 1: Fetching RSS feeds...');
  const t1 = Date.now();
  const { items, sourceErrors } = await fetchAllFeeds();
  console.log(`  ${items.length} items, ${sourceErrors} source errors, ${((Date.now() - t1) / 1000).toFixed(1)}s`);

  console.log('Step 2: Deduplicating...');
  const t2 = Date.now();
  const { unique, duplicates } = deduplicateStories(items);
  console.log(`  ${unique.length} unique (${duplicates} dupes), ${((Date.now() - t2) / 1000).toFixed(1)}s`);

  console.log('Step 3: Selecting for assessment...');
  const toAssess = selectForClassification(unique, TEST_COUNT, PER_CATEGORY);
  console.log(`  ${toAssess.length} selected`);

  console.log('');
  console.log(`Assessing ${toAssess.length} stories...`);
  console.log('');

  const samples: Sample[] = [];

  for (let i = 0; i < toAssess.length; i++) {
    const item = toAssess[i];
    const tCall = Date.now();
    const result = await assessStory(item);
    const ms = Date.now() - tCall;

    if (result) {
      samples.push({
        headline: item.title,
        source: item.source,
        category: result.category,
        biasTag: result.bias_tag,
        manipIdx: result.manipulation_index,
        priority: result.priority,
        quickTake: result.quick_take,
        ms,
      });
    }

    process.stdout.write(`\r  ${i + 1}/${toAssess.length}`);
  }
  process.stdout.write('\n');

  console.log('');
  console.log('━━━ Results ━━━');

  const total = samples.length || 1;
  const totalMs = samples.reduce((s, x) => s + x.ms, 0);
  console.log(`${samples.length} assessed, avg ${(totalMs / total).toFixed(0)}ms per story`);
  console.log(`Total wall clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  console.log('');
  console.log('━━━ Sample assessments (random 10) ━━━');
  const sampleIdx = new Set<number>();
  while (sampleIdx.size < Math.min(10, samples.length)) {
    sampleIdx.add(Math.floor(Math.random() * samples.length));
  }
  for (const i of sampleIdx) {
    const s = samples[i];
    console.log(`\n(${s.ms}ms)`);
    console.log(`  source: ${s.source}`);
    console.log(`  headline: ${s.headline}`);
    console.log(`  cat=${s.category}  bias=${s.biasTag}  manip=${s.manipIdx}  priority=${s.priority}`);
    console.log(`  quick: ${s.quickTake}`);
  }
}

main().catch((err) => {
  console.error('Assess test failed:', err);
  process.exit(1);
});
