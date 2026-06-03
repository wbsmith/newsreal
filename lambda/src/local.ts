import 'dotenv/config';
import { runFullPipeline } from './handler.js';

async function main() {
  const t0 = Date.now();
  console.log('━━━ NewsReal local pipeline ━━━');
  console.log(`LLM base:       ${process.env.LLM_BASE_URL || 'http://localhost:1234/v1'}`);
  console.log(`Model:          ${process.env.LOCAL_ANALYZE_MODEL || 'gemma4-31b'}`);
  console.log(`Assess count:   ${process.env.ASSESS_COUNT || process.env.CLASSIFY_COUNT || '150'} (batch ${process.env.ASSESS_BATCH_SIZE || '10'})`);
  console.log(`Rank weights:   manipulation=${process.env.RANK_WEIGHT_MANIPULATION ?? '0.6'} recency=${process.env.RANK_WEIGHT_RECENCY ?? '0.2'} prestige=${process.env.RANK_WEIGHT_PRESTIGE ?? '0.2'}`);
  console.log('');

  const result = await runFullPipeline();
  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('\n━━━ Result ━━━');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nTotal wall clock: ${totalSec}s`);

  // Stray keep-alive sockets (RSS feeds, AWS SDK) can pin the event loop —
  // exit explicitly once the pipeline has fully completed.
  process.exit(0);
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
