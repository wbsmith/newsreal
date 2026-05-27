import { classifyWithBedrock, analyzeWithBedrock } from './bedrock';

const BACKEND = process.env.LLM_BACKEND || 'bedrock';
const LOCAL_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:1234/v1';
const LOCAL_MODEL = process.env.LLM_MODEL || 'gemma4-31b';
const LOCAL_API_KEY = process.env.LLM_API_KEY || 'not-needed';

async function localComplete(
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string | null> {
  try {
    const res = await fetch(`${LOCAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (!res.ok) {
      console.error('Local LLM error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error('Local LLM error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function classify(prompt: string): Promise<string | null> {
  if (BACKEND === 'local') {
    return localComplete([{ role: 'user', content: prompt }], 1024);
  }
  return classifyWithBedrock(prompt);
}

export async function analyze(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  if (BACKEND === 'local') {
    return localComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 4096);
  }
  return analyzeWithBedrock(systemPrompt, userPrompt);
}
