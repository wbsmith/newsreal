import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { upsertStory, embed, countStories } from './local-store.js';

const TABLE = 'newsreal-stories';
const REGION = process.env.NEWSREAL_AWS_REGION || process.env.AWS_REGION || 'us-east-1';

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
  console.log('');

  const before = countStories();
  console.log(`Local store before: ${before.total} stories (${before.withEmbedding} with embeddings)`);
  console.log('');

  const items = await scanAll();
  console.log(`Found ${items.length} items in DDB. Importing + embedding...`);

  let imported = 0;
  let embedded = 0;
  let embedFailures = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const slug = (item.id || item.slug) as string | undefined;
    const headline = item.headline as string | undefined;
    if (!slug || !headline) { skipped++; continue; }

    const category = (item.category as string) || 'world';
    const biasTag = ((item.biasTag as Record<string, unknown>)?.label as string) || 'UNREPORTED';
    const manipulationIndex = (item.manipulationScore as number) ?? 0;
    const priority = (item.priority as string) || 'medium';
    const quickTake = (item.realAnalysis as string) || (item.summary as string) || '';

    // Serialize the deepDive subdocument as analysis_json so we keep it locally
    const analysisJson = item.deepDive ? JSON.stringify(item.deepDive) : null;

    // Embed the headline (skip silently if LM Studio is down — entry still gets stored without embedding)
    let embedding = await embed(headline);
    if (embedding) embedded++;
    else embedFailures++;

    upsertStory({
      slug,
      headline,
      source: (item.source as string) || '',
      publishedAt: (item.publishedAt as string) ?? null,
      category,
      biasTag,
      manipulationIndex,
      priority,
      quickTake,
      embedding,
      analysisJson,
    });

    imported++;
    if (imported % 10 === 0) {
      process.stdout.write(`\r  Imported ${imported}/${items.length}  (embedded: ${embedded}, failed: ${embedFailures})`);
    }
  }
  process.stdout.write('\n');

  const after = countStories();
  console.log('');
  console.log(`Imported: ${imported}, skipped (missing slug/headline): ${skipped}`);
  console.log(`Embeddings — succeeded: ${embedded}, failed: ${embedFailures}`);
  console.log(`Local store after: ${after.total} stories (${after.withEmbedding} with embeddings)`);
  console.log(`Total wall clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (embedFailures > 0) {
    console.log('');
    console.log(`Note: ${embedFailures} embeddings failed. Likely LM Studio embedding model not loaded.`);
    console.log(`Re-run this script after loading the embedding model to fill them in.`);
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
