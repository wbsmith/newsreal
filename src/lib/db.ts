import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
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
