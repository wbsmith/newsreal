import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

let client: BedrockRuntimeClient | null = null;

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.google.gemma-3-27b-it';

function getBedrockClient(): BedrockRuntimeClient | null {
  if (client) return client;

  const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY;
  const region = process.env.BEDROCK_REGION;

  if (!accessKeyId || !secretAccessKey || !region) {
    console.warn('Bedrock credentials not configured — on-demand analysis disabled');
    return null;
  }

  client = new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export async function classifyWithBedrock(prompt: string): Promise<string | null> {
  const bedrock = getBedrockClient();
  if (!bedrock) return null;

  try {
    const response = await bedrock.send(new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 1024 },
    }));

    const block = response.output?.message?.content?.[0];
    if (block && 'text' in block) return block.text ?? null;
    return null;
  } catch (err) {
    console.error('Bedrock classification error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function analyzeWithBedrock(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  const bedrock = getBedrockClient();
  if (!bedrock) return null;

  try {
    const response = await bedrock.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user', content: [{ text: userPrompt }] }],
      inferenceConfig: { maxTokens: 4096 },
    }));

    const block = response.output?.message?.content?.[0];
    if (block && 'text' in block) return block.text ?? null;
    return null;
  } catch (err) {
    console.error('Bedrock analysis error:', err instanceof Error ? err.message : err);
    return null;
  }
}
