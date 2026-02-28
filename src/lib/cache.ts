import { getDynamoDB, TABLES } from './db';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB-based cache with TTL.
 * Uses a dedicated cache table with automatic expiry via DynamoDB TTL.
 */

export async function getCached<T>(key: string): Promise<T | null> {
  const db = getDynamoDB();
  if (!db) return null;

  try {
    const result = await db.send(
      new GetCommand({
        TableName: TABLES.cache,
        Key: { cacheKey: key },
      })
    );

    if (!result.Item) return null;

    // Check if expired (DynamoDB TTL is eventually consistent, so double-check)
    const now = Math.floor(Date.now() / 1000);
    if (result.Item.ttl && result.Item.ttl < now) return null;

    return result.Item.value as T;
  } catch {
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds = 21600 // 6 hours default
): Promise<void> {
  const db = getDynamoDB();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);

  await db.send(
    new PutCommand({
      TableName: TABLES.cache,
      Item: {
        cacheKey: key,
        value,
        ttl: now + ttlSeconds,
        createdAt: new Date().toISOString(),
      },
    })
  );
}
