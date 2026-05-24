import 'dotenv/config';
import { runFullPipeline } from './handler.js';

async function main() {
  const t0 = Date.now();
  console.log('━━━ NewsReal local pipeline ━━━');
  console.log(`LLM base:       ${process.env.LLM_BASE_URL || 'http://localhost:1234/v1'}`);
  console.log(`Classify model: ${process.env.LOCAL_CLASSIFY_MODEL || 'nemotron-3-nano-omni'}`);
  console.log(`Analyze model:  ${process.env.LOCAL_ANALYZE_MODEL || 'gemma4-31b'}`);
  console.log(`Classify count: ${process.env.CLASSIFY_COUNT || '120'} (batch ${process.env.CLASSIFY_BATCH_SIZE || '10'})`);
  console.log(`Analyze count:  ${process.env.DEEP_ANALYZE_COUNT || '120'} (batch ${process.env.ANALYZE_BATCH_SIZE || '5'})`);
  console.log(`Rank weights:   manipulation=${process.env.RANK_WEIGHT_MANIPULATION ?? '0.6'} recency=${process.env.RANK_WEIGHT_RECENCY ?? '0.2'} prestige=${process.env.RANK_WEIGHT_PRESTIGE ?? '0.2'}`);
  console.log('');

  const result = await runFullPipeline();
  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('\n━━━ Result ━━━');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nTotal wall clock: ${totalSec}s`);
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
