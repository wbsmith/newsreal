import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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
const CACHE_TABLE = 'newsreal-cache';
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

/**
 * Build the set of story slugs that have EVER been shared. These are kept
 * forever regardless of age.
 *
 * Shares are tracked in newsreal-cache under keys `analytics:YYYY-MM-DD`,
 * with a `shares: Record<shareKey, count>` field. shareKey format is either
 * a bare slug (old) or `${type}:${id}` (new). We collect only `story:*`
 * entries and bare slugs (everything pre-namespace was a story share).
 */
async function getProtectedStorySlugs(ddb: DynamoDBDocumentClient): Promise<Set<string>> {
  const protectedSlugs = new Set<string>();

  // Manifest of days that have analytics records
  const manifestRes = await ddb.send(new GetCommand({
    TableName: CACHE_TABLE,
    Key: { cacheKey: 'analytics-days' },
  }));
  const days: string[] = (manifestRes.Item?.value as string[]) ?? [];

  for (const day of days) {
    const dayRes = await ddb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cacheKey: `analytics:${day}` },
    }));
    const shares = (dayRes.Item?.value as { shares?: Record<string, number> })?.shares ?? {};
    for (const shareKey of Object.keys(shares)) {
      const colon = shareKey.indexOf(':');
      if (colon < 0) {
        // Old format: bare slug, always a story
        protectedSlugs.add(shareKey);
      } else {
        const type = shareKey.slice(0, colon);
        const id = shareKey.slice(colon + 1);
        // Only stories live in newsreal-stories; narrative/search-analysis live
        // elsewhere and aren't candidates for this purge anyway.
        if (type === 'story') protectedSlugs.add(id);
      }
    }
  }

  return protectedSlugs;
}

async function main() {
  const t0 = Date.now();
  const cutoffMs = Date.now() - OLDER_THAN_DAYS * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  console.log('━━━ Purge stories older than threshold ━━━');
  console.log(`Cutoff: ${cutoffIso} (${OLDER_THAN_DAYS} days ago)`);
  console.log(`Mode: ${CONFIRM ? 'DELETING' : 'DRY-RUN (no actual deletes — pass --confirm to delete)'}`);
  console.log('');

  // ─── Build share-protection set ───
  console.log('Loading share-protection set from analytics...');
  const ddb = getDDB();
  const protectedSlugs = await getProtectedStorySlugs(ddb);
  console.log(`Protected: ${protectedSlugs.size} story slugs that have been shared (kept forever)`);
  console.log('');

  // ─── DynamoDB ───
  console.log('Scanning DynamoDB stories table...');
  const toDelete: string[] = [];
  let scanned = 0;
  let protectedHits = 0;
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
      const isOld = isNaN(t) || t < cutoffMs;
      if (!isOld) continue;
      if (protectedSlugs.has(id)) { protectedHits++; continue; }
      toDelete.push(id);
    }
    lastKey = result.LastEvaluatedKey;
    process.stdout.write(`\r  Scanned ${scanned}, marked ${toDelete.length} for delete (${protectedHits} protected by share-history)`);
  } while (lastKey);
  process.stdout.write('\n');

  console.log(`DDB: ${scanned} total, ${toDelete.length} eligible to delete, ${protectedHits} protected by share-history`);

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
  // Build placeholders for the protected slug list to use in NOT IN. SQLite
  // has a parameter-count limit (~999); chunk if necessary, but at our scale
  // (single-digit hundreds of shares) one statement is fine.
  const protectedArr = Array.from(protectedSlugs);
  const placeholders = protectedArr.length > 0 ? protectedArr.map(() => '?').join(',') : null;
  const localCandidatesQuery = placeholders
    ? `SELECT slug FROM stories WHERE (published_at IS NULL OR published_at < ?) AND slug NOT IN (${placeholders})`
    : `SELECT slug FROM stories WHERE (published_at IS NULL OR published_at < ?)`;
  const args = placeholders ? [cutoffIso, ...protectedArr] : [cutoffIso];
  const localCandidates = db.prepare(localCandidatesQuery).all(...args) as { slug: string }[];
  console.log(`Local: ${localCandidates.length} rows eligible to delete (older than cutoff and not share-protected)`);

  if (CONFIRM && localCandidates.length > 0) {
    const delStmt = db.prepare(`DELETE FROM stories WHERE slug = ?`);
    const txn = db.transaction((slugs: string[]) => {
      for (const s of slugs) delStmt.run(s);
    });
    txn(localCandidates.map((c) => c.slug));
    console.log(`  Deleted ${localCandidates.length} from local SQLite`);
  } else if (localCandidates.length > 0) {
    console.log(`  (Would delete ${localCandidates.length} from local SQLite — pass --confirm)`);
  }

  console.log('');
  console.log(`Total wall clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (!CONFIRM) console.log('No deletes performed. Pass --confirm to actually delete.');
}

main().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
