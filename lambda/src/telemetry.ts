import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TokenRecord {
  model: string;
  label: string;
  tokensIn: number;
  tokensOut: number;
  elapsed: number;
  timestamp: number;
}

const ENABLED = process.env.TRACK_TOKENS === 'true';
const LOG_FILE = process.env.TOKEN_LOG_FILE || '';  // e.g. ./data/token-log.jsonl

const records: TokenRecord[] = [];

export function track(model: string, label: string, tokensIn: number, tokensOut: number, elapsed: number): void {
  if (!ENABLED) return;
  const rec: TokenRecord = { model, label, tokensIn, tokensOut, elapsed, timestamp: Date.now() };
  records.push(rec);
  if (LOG_FILE) {
    try {
      mkdirSync(dirname(LOG_FILE), { recursive: true });
      appendFileSync(LOG_FILE, JSON.stringify(rec) + '\n');
    } catch {}
  }
}

export function getRecords(): TokenRecord[] {
  return records;
}

interface GroupStats {
  label: string;
  model: string;
  count: number;
  tokensIn: { mean: number; variance: number; min: number; max: number; total: number };
  tokensOut: { mean: number; variance: number; min: number; max: number; total: number };
  elapsed: { mean: number; variance: number; min: number; max: number; total: number };
}

function computeStats(values: number[]): { mean: number; variance: number; min: number; max: number; total: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, variance: 0, min: 0, max: 0, total: 0 };
  const total = values.reduce((s, v) => s + v, 0);
  const mean = total / n;
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return { mean: Math.round(mean), variance: Math.round(variance), min: Math.min(...values), max: Math.max(...values), total };
}

export function getStatsByLabel(): GroupStats[] {
  const groups = new Map<string, TokenRecord[]>();
  for (const r of records) {
    const key = `${r.label}|${r.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const result: GroupStats[] = [];
  for (const [, calls] of groups) {
    result.push({
      label: calls[0].label,
      model: calls[0].model,
      count: calls.length,
      tokensIn: computeStats(calls.map(c => c.tokensIn)),
      tokensOut: computeStats(calls.map(c => c.tokensOut)),
      elapsed: computeStats(calls.map(c => c.elapsed)),
    });
  }
  return result;
}

export function printReport(): void {
  if (records.length === 0) return;

  const stats = getStatsByLabel();
  console.log('\n═══ TOKEN USAGE REPORT ═══');

  for (const g of stats) {
    console.log(`\n  ${g.model} [${g.label}] (${g.count} calls, ${(g.elapsed.total / 1000).toFixed(1)}s total):`);
    console.log(`    Input:  mean=${g.tokensIn.mean}  σ²=${g.tokensIn.variance}  min=${g.tokensIn.min}  max=${g.tokensIn.max}  total=${g.tokensIn.total}`);
    console.log(`    Output: mean=${g.tokensOut.mean}  σ²=${g.tokensOut.variance}  min=${g.tokensOut.min}  max=${g.tokensOut.max}  total=${g.tokensOut.total}`);
    console.log(`    Time:   mean=${g.elapsed.mean}ms  σ²=${g.elapsed.variance}  min=${g.elapsed.min}ms  max=${g.elapsed.max}ms`);
  }

  const totalIn = records.reduce((s, c) => s + c.tokensIn, 0);
  const totalOut = records.reduce((s, c) => s + c.tokensOut, 0);
  const totalTime = records.reduce((s, c) => s + c.elapsed, 0);
  console.log(`\n  TOTAL: ${records.length} calls, ${totalIn} in, ${totalOut} out, ${(totalTime / 1000).toFixed(1)}s`);
  console.log('══════════════════════════\n');
}
