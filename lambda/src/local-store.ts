import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import OpenAI from 'openai';
import { track } from './telemetry.js';

const DB_PATH = process.env.LOCAL_DB_PATH || './data/newsreal.db';
const EMBEDDING_MODEL = process.env.LOCAL_EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5';
const EMBEDDING_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:1234/v1';
export const CACHE_HIT_THRESHOLD = Number(process.env.CACHE_HIT_THRESHOLD ?? 0.92);

export interface CachedStory {
  slug: string;
  headline: string;
  source: string;
  publishedAt: string | null;
  cachedAt: string;
  category: string;
  biasTag: string;
  manipulationIndex: number;
  priority: string;
  quickTake: string;
  embedding: Float32Array | null;
  analysisJson: string | null;
}

let db: Database.Database | null = null;
let embedClient: OpenAI | null = null;

export function getStore(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      slug TEXT PRIMARY KEY,
      headline TEXT NOT NULL,
      source TEXT,
      published_at TEXT,
      cached_at TEXT NOT NULL,
      category TEXT,
      bias_tag TEXT,
      manipulation_index INTEGER,
      priority TEXT,
      quick_take TEXT,
      embedding BLOB,
      analysis_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_stories_cached_at ON stories(cached_at);
    CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
  `);
  return db;
}

function getEmbedClient(): OpenAI {
  if (!embedClient) {
    embedClient = new OpenAI({
      baseURL: EMBEDDING_BASE_URL,
      apiKey: process.env.LLM_API_KEY || 'not-needed',
    });
  }
  return embedClient;
}

export async function embed(text: string): Promise<Float32Array | null> {
  const batch = await embedBatch([text]);
  return batch[0] ?? null;
}

/**
 * Embed multiple texts in one HTTP request. LM Studio's /v1/embeddings
 * accepts input: string[] and returns one embedding per element. ~5-10x
 * faster than sequential calls for bulk operations like initial sync.
 */
export async function embedBatch(texts: string[]): Promise<(Float32Array | null)[]> {
  if (texts.length === 0) return [];
  try {
    const start = Date.now();
    const response = await getEmbedClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    });
    track(EMBEDDING_MODEL, 'embedding', response.usage?.prompt_tokens ?? 0, 0, Date.now() - start);
    return texts.map((_, i) => {
      const vec = response.data[i]?.embedding;
      return vec ? new Float32Array(vec as number[]) : null;
    });
  } catch (err) {
    console.error('Embedding batch error:', err instanceof Error ? err.message : err);
    return texts.map(() => null);
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function rowToCached(row: Record<string, unknown>): CachedStory {
  return {
    slug: row.slug as string,
    headline: row.headline as string,
    source: row.source as string,
    publishedAt: (row.published_at as string) ?? null,
    cachedAt: row.cached_at as string,
    category: row.category as string,
    biasTag: row.bias_tag as string,
    manipulationIndex: row.manipulation_index as number,
    priority: row.priority as string,
    quickTake: row.quick_take as string,
    embedding: row.embedding ? new Float32Array((row.embedding as Buffer).buffer, (row.embedding as Buffer).byteOffset, (row.embedding as Buffer).byteLength / 4) : null,
    analysisJson: (row.analysis_json as string) ?? null,
  };
}

export interface CacheHit {
  similarity: number;
  story: CachedStory;
}

/**
 * Find the most similar cached story whose embedding is above threshold.
 * Brute-force cosine across all rows — fine for our scale (~10K).
 */
export function findNearestNeighbor(queryEmbedding: Float32Array, threshold = CACHE_HIT_THRESHOLD): CacheHit | null {
  const rows = getStore().prepare(`SELECT * FROM stories WHERE embedding IS NOT NULL`).all() as Record<string, unknown>[];
  let best: CacheHit | null = null;
  for (const row of rows) {
    const buf = row.embedding as Buffer;
    const candidate = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const sim = cosineSimilarity(queryEmbedding, candidate);
    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { similarity: sim, story: rowToCached(row) };
    }
  }
  return best;
}

export interface UpsertInput {
  slug: string;
  headline: string;
  source: string;
  publishedAt?: string | null;
  category: string;
  biasTag: string;
  manipulationIndex: number;
  priority: string;
  quickTake: string;
  embedding?: Float32Array | null;
  analysisJson?: string | null;
}

export function upsertStory(input: UpsertInput): void {
  const embBuf = input.embedding ? Buffer.from(input.embedding.buffer, input.embedding.byteOffset, input.embedding.byteLength) : null;
  getStore().prepare(`
    INSERT INTO stories (slug, headline, source, published_at, cached_at, category, bias_tag, manipulation_index, priority, quick_take, embedding, analysis_json)
    VALUES (@slug, @headline, @source, @publishedAt, @cachedAt, @category, @biasTag, @manipulationIndex, @priority, @quickTake, @embedding, @analysisJson)
    ON CONFLICT(slug) DO UPDATE SET
      headline = excluded.headline,
      source = excluded.source,
      published_at = excluded.published_at,
      cached_at = excluded.cached_at,
      category = excluded.category,
      bias_tag = excluded.bias_tag,
      manipulation_index = excluded.manipulation_index,
      priority = excluded.priority,
      quick_take = excluded.quick_take,
      embedding = COALESCE(excluded.embedding, stories.embedding),
      analysis_json = COALESCE(excluded.analysis_json, stories.analysis_json)
  `).run({
    slug: String(input.slug),
    headline: String(input.headline),
    source: input.source != null ? String(input.source) : '',
    publishedAt: input.publishedAt != null ? String(input.publishedAt) : null,
    cachedAt: new Date().toISOString(),
    category: input.category != null ? String(input.category) : 'world',
    biasTag: input.biasTag != null ? String(input.biasTag) : 'UNREPORTED',
    manipulationIndex: typeof input.manipulationIndex === 'number' && Number.isFinite(input.manipulationIndex)
      ? Math.round(input.manipulationIndex)
      : 0,
    priority: input.priority != null ? String(input.priority) : 'medium',
    quickTake: input.quickTake != null ? String(input.quickTake) : '',
    embedding: embBuf,
    analysisJson: input.analysisJson != null ? String(input.analysisJson) : null,
  });
}

/**
 * Cheap existence check used by the sync script to skip rows already imported.
 * Avoids re-embedding 30K stories on resume.
 */
export function hasStory(slug: string): boolean {
  const row = getStore().prepare(`SELECT 1 FROM stories WHERE slug = ? LIMIT 1`).get(slug);
  return !!row;
}

export function getStoryBySlug(slug: string): CachedStory | null {
  const row = getStore().prepare(`SELECT * FROM stories WHERE slug = ?`).get(slug) as Record<string, unknown> | undefined;
  return row ? rowToCached(row) : null;
}

export function countStories(): { total: number; withEmbedding: number } {
  const total = (getStore().prepare(`SELECT COUNT(*) as c FROM stories`).get() as { c: number }).c;
  const withEmbedding = (getStore().prepare(`SELECT COUNT(*) as c FROM stories WHERE embedding IS NOT NULL`).get() as { c: number }).c;
  return { total, withEmbedding };
}

// ─── Category centroids (Phase 4) ───
// Build a centroid per category by averaging the embeddings of prototype headlines.
// Cached in-memory after first build.

export type CentroidMap = Map<string, Float32Array>;
let centroidsCache: CentroidMap | null = null;

export async function buildCategoryCentroids(prototypes: Record<string, string[]>): Promise<CentroidMap> {
  if (centroidsCache) return centroidsCache;
  const map: CentroidMap = new Map();
  for (const [category, examples] of Object.entries(prototypes)) {
    const vecs: Float32Array[] = [];
    for (const ex of examples) {
      const v = await embed(ex);
      if (v) vecs.push(v);
    }
    if (vecs.length === 0) continue;
    const dim = vecs[0].length;
    const sum = new Float32Array(dim);
    for (const v of vecs) {
      for (let i = 0; i < dim; i++) sum[i] += v[i];
    }
    for (let i = 0; i < dim; i++) sum[i] /= vecs.length;
    map.set(category, sum);
  }
  centroidsCache = map;
  return map;
}

export interface CentroidMatch {
  category: string;
  similarity: number;
  margin: number; // top - runner-up
}

export function matchByCentroid(queryEmbedding: Float32Array, centroids: CentroidMap): CentroidMatch | null {
  const scores: { category: string; sim: number }[] = [];
  for (const [category, centroid] of centroids) {
    scores.push({ category, sim: cosineSimilarity(queryEmbedding, centroid) });
  }
  if (scores.length === 0) return null;
  scores.sort((a, b) => b.sim - a.sim);
  const top = scores[0];
  const runnerUp = scores[1]?.sim ?? 0;
  return { category: top.category, similarity: top.sim, margin: top.sim - runnerUp };
}
