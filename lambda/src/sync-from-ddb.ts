import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { upsertStory, embedBatch, countStories, hasStory } from './local-store.js';

const TABLE = 'newsreal-stories';
const REGION = process.env.NEWSREAL_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
const SYNC_SINCE_DAYS = process.env.SYNC_SINCE_DAYS ? Number(process.env.SYNC_SINCE_DAYS) : null;
const EMBED_BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE ?? 20);

function getDDB(): DynamoDBDocumentClient {
  const credentials =
    process.env.NEWSREAL_AWS_ACCESS_KEY_ID && process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.NEWSREAL_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY,
        }
      : undefined;
  const client = new DynamoDBClient({ region: REGION, credentials });
  return DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
}

async function scanAll(): Promise<Record<string, unknown>[]> {
  const ddb = getDDB();
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  let pageCount = 0;
  do {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }));
    if (result.Items) items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
    pageCount++;
    process.stdout.write(`\r  Scanning DDB... page ${pageCount}, ${items.length} items so far`);
  } while (lastKey);
  process.stdout.write('\n');
  return items;
}

async function main() {
  const t0 = Date.now();
  console.log('━━━ Sync newsreal-stories → local SQLite ━━━');
  console.log(`Region: ${REGION}`);
  console.log(`Embedding model: ${process.env.LOCAL_EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5'}`);
  console.log(`LLM base: ${process.env.LLM_BASE_URL || 'http://localhost:1234/v1'}`);
  console.log(`Embed batch size: ${EMBED_BATCH_SIZE}`);
  if (SYNC_SINCE_DAYS !== null) {
    console.log(`Date filter: only stories from the last ${SYNC_SINCE_DAYS} days`);
  } else {
    console.log(`Date filter: none (importing all rows)`);
  }
  console.log('');

  const before = countStories();
  console.log(`Local store before: ${before.total} stories (${before.withEmbedding} with embeddings)`);
  console.log('');

  const allItems = await scanAll();

  // Apply date filter
  const cutoffMs = SYNC_SINCE_DAYS !== null ? Date.now() - SYNC_SINCE_DAYS * 24 * 60 * 60 * 1000 : null;
  const items = cutoffMs !== null
    ? allItems.filter((it) => {
        const published = it.publishedAt as string | undefined;
        if (!published) return false;
        const t = new Date(published).getTime();
        return !isNaN(t) && t >= cutoffMs;
      })
    : allItems;

  if (cutoffMs !== null) {
    console.log(`Date filter dropped ${allItems.length - items.length} rows (kept ${items.length})`);
  }
  console.log(`Importing ${items.length} stories in batches of ${EMBED_BATCH_SIZE}...`);
  console.log('');

  let imported = 0;
  let embedded = 0;
  let embedFailures = 0;
  let skipped = 0;
  let alreadyHave = 0;
  const FORCE_REEMBED = process.env.FORCE_REEMBED === 'true';

  for (let i = 0; i < items.length; i += EMBED_BATCH_SIZE) {
    const batch = items.slice(i, i + EMBED_BATCH_SIZE);

    // Pre-filter and assemble (slug, headline, item) tuples
    const valid: { slug: string; headline: string; item: Record<string, unknown> }[] = [];
    for (const item of batch) {
      const slug = (item.id || item.slug) as string | undefined;
      const headline = item.headline as string | undefined;
      if (!slug || !headline) { skipped++; continue; }
      // Resume optimization: skip rows already present locally (override with FORCE_REEMBED=true)
      if (!FORCE_REEMBED && hasStory(slug)) { alreadyHave++; continue; }
      valid.push({ slug, headline, item });
    }

    if (valid.length === 0) {
      const pct = (((i + EMBED_BATCH_SIZE) / items.length) * 100).toFixed(1);
      process.stdout.write(`\r  Scanned ${i + EMBED_BATCH_SIZE}/${items.length} (${pct}%) — imported: ${imported}, skipped-already-have: ${alreadyHave}`);
      continue;
    }

    // Batch embedding call
    const embeddings = await embedBatch(valid.map((v) => v.headline));

    for (let j = 0; j < valid.length; j++) {
      const { slug, headline, item } = valid[j];
      const embedding = embeddings[j];
      if (embedding) embedded++; else embedFailures++;

      upsertStory({
        slug,
        headline,
        source: (item.source as string) || '',
        publishedAt: (item.publishedAt as string) ?? null,
        category: (item.category as string) || 'world',
        biasTag: ((item.biasTag as Record<string, unknown>)?.label as string) || 'UNREPORTED',
        manipulationIndex: (item.manipulationScore as number) ?? 0,
        priority: (item.priority as string) || 'medium',
        quickTake: (item.realAnalysis as string) || (item.summary as string) || '',
        embedding,
        analysisJson: item.deepDive ? JSON.stringify(item.deepDive) : null,
      });
      imported++;
    }

    const pct = (((i + EMBED_BATCH_SIZE) / items.length) * 100).toFixed(1);
    process.stdout.write(`\r  Scanned ${Math.min(i + EMBED_BATCH_SIZE, items.length)}/${items.length} (${pct}%) — imported: ${imported}, already-had: ${alreadyHave}, embed-fail: ${embedFailures}`);
  }
  process.stdout.write('\n');

  const after = countStories();
  console.log('');
  console.log(`Imported this run: ${imported} (skipped already-imported: ${alreadyHave}, missing slug/headline: ${skipped})`);
  console.log(`Embeddings — succeeded: ${embedded}, failed: ${embedFailures}`);
  console.log(`Local store after: ${after.total} stories (${after.withEmbedding} with embeddings)`);
  console.log(`Total wall clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (embedFailures > 0) {
    console.log('');
    console.log(`Note: ${embedFailures} embeddings failed. Likely LM Studio embedding model not loaded`);
    console.log(`or batch size too large for the model's context. Re-run after fixing.`);
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
