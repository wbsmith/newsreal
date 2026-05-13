import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { getStore } from './local-store.js';

/**
 * Purge stories older than PURGE_OLDER_THAN_DAYS (default 90) from both
 * DynamoDB (newsreal-stories) and the local SQLite cache.
 *
 * Dry-run by default. Pass --confirm to actually delete.
 *
 *   npm run purge-old                                    # dry-run, 90 days
 *   PURGE_OLDER_THAN_DAYS=180 npm run purge-old          # dry-run, 180 days
 *   PURGE_OLDER_THAN_DAYS=90 npm run purge-old -- --confirm  # actually delete
 */

const TABLE = 'newsreal-stories';
const REGION = process.env.NEWSREAL_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
const OLDER_THAN_DAYS = Number(process.env.PURGE_OLDER_THAN_DAYS ?? 90);
const CONFIRM = process.argv.includes('--confirm');

function getDDB(): DynamoDBDocumentClient {
  const credentials =
    process.env.NEWSREAL_AWS_ACCESS_KEY_ID && process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.NEWSREAL_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY,
        }
      : undefined;
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION, credentials }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

async function main() {
  const t0 = Date.now();
  const cutoffMs = Date.now() - OLDER_THAN_DAYS * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  console.log('━━━ Purge stories older than threshold ━━━');
  console.log(`Cutoff: ${cutoffIso} (${OLDER_THAN_DAYS} days ago)`);
  console.log(`Mode: ${CONFIRM ? 'DELETING' : 'DRY-RUN (no actual deletes — pass --confirm to delete)'}`);
  console.log('');

  // ─── DynamoDB ───
  console.log('Scanning DynamoDB...');
  const ddb = getDDB();
  const toDelete: string[] = [];
  let scanned = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({
      TableName: TABLE,
      ExclusiveStartKey: lastKey,
      ProjectionExpression: 'id, publishedAt',
    }));
    for (const item of result.Items || []) {
      scanned++;
      const published = item.publishedAt as string | undefined;
      const id = item.id as string | undefined;
      if (!published || !id) continue;
      const t = new Date(published).getTime();
      if (isNaN(t) || t < cutoffMs) toDelete.push(id);
    }
    lastKey = result.LastEvaluatedKey;
    process.stdout.write(`\r  Scanned ${scanned}, marked ${toDelete.length} for delete`);
  } while (lastKey);
  process.stdout.write('\n');

  console.log(`DDB: ${scanned} total rows, ${toDelete.length} older than cutoff`);

  if (CONFIRM && toDelete.length > 0) {
    console.log(`  Deleting ${toDelete.length} from DynamoDB in batches of 25...`);
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 25) {
      const batch = toDelete.slice(i, i + 25);
      await ddb.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE]: batch.map((id) => ({ DeleteRequest: { Key: { id } } })),
        },
      }));
      deleted += batch.length;
      process.stdout.write(`\r    Deleted ${deleted}/${toDelete.length}`);
    }
    process.stdout.write('\n');
  } else if (toDelete.length > 0) {
    console.log(`  (Would delete ${toDelete.length} from DynamoDB — pass --confirm)`);
    console.log(`  Sample: ${toDelete.slice(0, 3).join(', ')}${toDelete.length > 3 ? ', ...' : ''}`);
  }

  // ─── Local SQLite ───
  console.log('');
  console.log('Scanning local SQLite...');
  const db = getStore();
  const localToDelete = db.prepare(
    `SELECT COUNT(*) as c FROM stories WHERE published_at IS NULL OR published_at < ?`
  ).get(cutoffIso) as { c: number };
  console.log(`Local: ${localToDelete.c} rows older than cutoff (or with null publishedAt)`);

  if (CONFIRM && localToDelete.c > 0) {
    const result = db.prepare(
      `DELETE FROM stories WHERE published_at IS NULL OR published_at < ?`
    ).run(cutoffIso);
    console.log(`  Deleted ${result.changes} from local SQLite`);
  } else if (localToDelete.c > 0) {
    console.log(`  (Would delete ${localToDelete.c} from local SQLite — pass --confirm)`);
  }

  console.log('');
  console.log(`Total wall clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (!CONFIRM) console.log('No deletes performed. Pass --confirm to actually delete.');
}

main().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
