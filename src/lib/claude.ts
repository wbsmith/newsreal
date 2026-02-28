import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('Anthropic API key not configured — AI analysis disabled');
    return null;
  }

  client = new Anthropic({ apiKey });
  return client;
}

export async function analyzeWithSonnet(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type === 'text') return block.text;
  return null;
}

export async function classifyWithHaiku(prompt: string): Promise<string | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (block.type === 'text') return block.text;
  return null;
}
