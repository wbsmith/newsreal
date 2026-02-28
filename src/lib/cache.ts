import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Upstash Redis not configured — caching disabled');
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  return client.get<T>(key);
}

export async function setCached<T>(key: string, value: T, ttlSeconds = 21600): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.set(key, value, { ex: ttlSeconds });
}
