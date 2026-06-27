import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE_PREFIX = 'newsreal';

export const TABLES = {
  stories: `${TABLE_PREFIX}-stories`,
  analyses: `${TABLE_PREFIX}-analyses`,
  obfuscations: `${TABLE_PREFIX}-obfuscations`,
  narratives: `${TABLE_PREFIX}-narratives`,
  govFilings: `${TABLE_PREFIX}-gov-filings`,
  cache: `${TABLE_PREFIX}-cache`,
} as const;

let docClient: DynamoDBDocumentClient | null = null;

export function getDynamoDB(): DynamoDBDocumentClient | null {
  if (docClient) return docClient;

  const region = process.env.NEWSREAL_AWS_REGION || process.env.AWS_REGION;
  if (!region) {
    console.warn('AWS_REGION not configured — running with mock data');
    return null;
  }

  const credentials =
    process.env.NEWSREAL_AWS_ACCESS_KEY_ID && process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.NEWSREAL_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY,
        }
      : undefined;

  const client = new DynamoDBClient({ region, credentials });
  docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return docClient;
}

// ─── Story Operations ───

export async function putStory(story: Record<string, unknown>) {
  const db = getDynamoDB();
  if (!db) return;
  await db.send(new PutCommand({ TableName: TABLES.stories, Item: story }));
}

export async function getStory(id: string) {
  const db = getDynamoDB();
  if (!db) return null;
  const result = await db.send(
    new GetCommand({ TableName: TABLES.stories, Key: { id } })
  );
  return result.Item ?? null;
}

export async function getStoriesByCategory(category: string, limit = 20) {
  const db = getDynamoDB();
  if (!db) return [];
  const result = await db.send(
    new QueryCommand({
      TableName: TABLES.stories,
      IndexName: 'category-publishedAt-index',
      KeyConditionExpression: 'category = :cat',
      ExpressionAttributeValues: { ':cat': category },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return result.Items ?? [];
}

export async function getRecentStories(limit = 20) {
  const db = getDynamoDB();
  if (!db) return [];
  const result = await db.send(
    new ScanCommand({
      TableName: TABLES.stories,
      Limit: limit,
    })
  );
  return result.Items ?? [];
}

export async function batchGetStories(slugs: string[]): Promise<Record<string, unknown>[]> {
  const db = getDynamoDB();
  if (!db || slugs.length === 0) return [];

  const results: Record<string, unknown>[] = [];

  // BatchGetItem max 100 keys per request
  for (let i = 0; i < slugs.length; i += 100) {
    const batch = slugs.slice(i, i + 100);
    const resp = await db.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.stories]: {
            Keys: batch.map((slug) => ({ id: slug })),
          },
        },
      })
    );
    const items = resp.Responses?.[TABLES.stories] ?? [];
    results.push(...items);
  }

  return results;
}

const SEARCHABLE_CATEGORIES = ['politics', 'tech', 'finance', 'world', 'science', 'deep-state'];

// How deep (by recency) to look per category. The old implementation did a blind
// table scan in DynamoDB hash order and stopped after 500 *matches*; on a 40k+
// table where common terms ("trump") match thousands of rows, it bailed after
// scanning a few thousand items and silently dropped the rest — so any specific
// or just-published story usually never appeared. Querying the
// category-publishedAt GSI recent-first guarantees newly published stories (top
// of their category index) surface, and search returns the most recent matches.
const MAX_PER_CATEGORY = 1500;

export async function searchStories(query: string, limit = 20): Promise<Record<string, unknown>[]> {
  const db = getDynamoDB();
  if (!db) return [];

  const q = query.toLowerCase();

  const perCategory = await Promise.all(
    SEARCHABLE_CATEGORIES.map(async (category) => {
      const matches: Record<string, unknown>[] = [];
      let lastKey: Record<string, unknown> | undefined;
      let scanned = 0;
      do {
        const result = await db.send(
          new QueryCommand({
            TableName: TABLES.stories,
            IndexName: 'category-publishedAt-index',
            KeyConditionExpression: 'category = :cat',
            ExpressionAttributeValues: { ':cat': category },
            ScanIndexForward: false, // most recent first
            Limit: 200,
            ExclusiveStartKey: lastKey,
          })
        );
        const items = result.Items ?? [];
        scanned += items.length;
        for (const item of items) {
          const headline = (item.headline as string || '').toLowerCase();
          const summary = (item.summary as string || '').toLowerCase();
          if (headline.includes(q) || summary.includes(q)) matches.push(item);
        }
        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (lastKey && scanned < MAX_PER_CATEGORY);
      return matches;
    })
  );

  const allItems = perCategory.flat();

  // Sort by publishedAt descending, cap at limit
  allItems.sort((a, b) => {
    const ta = new Date(a.publishedAt as string || 0).getTime();
    const tb = new Date(b.publishedAt as string || 0).getTime();
    return tb - ta;
  });

  return allItems.slice(0, limit);
}

// ─── Analysis Operations ───

export async function putAnalysis(analysis: Record<string, unknown>) {
  const db = getDynamoDB();
  if (!db) return;
  await db.send(new PutCommand({ TableName: TABLES.analyses, Item: analysis }));
}

export async function getAnalysis(clusterId: string) {
  const db = getDynamoDB();
  if (!db) return null;
  const result = await db.send(
    new GetCommand({ TableName: TABLES.analyses, Key: { clusterId } })
  );
  return result.Item ?? null;
}

// ─── Obfuscation Operations ───

export async function putObfuscation(obfuscation: Record<string, unknown>) {
  const db = getDynamoDB();
  if (!db) return;
  await db.send(
    new PutCommand({ TableName: TABLES.obfuscations, Item: obfuscation })
  );
}

export async function getRecentObfuscations(limit = 10) {
  const db = getDynamoDB();
  if (!db) return [];
  const result = await db.send(
    new ScanCommand({ TableName: TABLES.obfuscations, Limit: limit })
  );
  return result.Items ?? [];
}

// ─── Narrative Operations ───

export async function putNarrative(narrative: Record<string, unknown>) {
  const db = getDynamoDB();
  if (!db) return;
  await db.send(
    new PutCommand({ TableName: TABLES.narratives, Item: narrative })
  );
}

export async function getRecentNarratives(limit = 10) {
  const db = getDynamoDB();
  if (!db) return [];
  const result = await db.send(
    new ScanCommand({ TableName: TABLES.narratives, Limit: limit })
  );
  return result.Items ?? [];
}
