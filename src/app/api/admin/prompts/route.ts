import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';

const PROMPT_TTL = 315360000; // ~10 years

// Registry of all editable prompts with their default values
const PROMPT_REGISTRY: Record<string, { description: string; type: 'system' | 'rubric' | 'instruction' }> = {
  'classify-system': { description: 'Classification instruction block (categories, bias tags, manipulation scoring)', type: 'instruction' },
  'analysis-system': { description: 'Deep analysis system prompt (tone, voice, behavioral instructions)', type: 'system' },
  'analysis-rubric': { description: 'Manipulation scoring rubric (5 dimensions, 0-20 each)', type: 'rubric' },
  'obfuscation-system': { description: 'Obfuscation detector system prompt', type: 'system' },
  'narrative-system': { description: 'Narrative tracker system prompt', type: 'system' },
  'narrative-rubric': { description: 'Coherence scoring rubric (4 dimensions, 0-25 each)', type: 'rubric' },
  'ticker-system': { description: 'Ticker alert generator system prompt', type: 'system' },
  'suppressed-system': { description: 'Suppressed searches generator system prompt', type: 'system' },
  'narrative-analysis-system': { description: 'Deep narrative analysis system prompt (Step 7b)', type: 'system' },
  'search-analysis-system': { description: 'Search analysis system prompt (Step 7c)', type: 'system' },
};

export async function GET() {
  try {
    const promptNames = Object.keys(PROMPT_REGISTRY);
    const overrides = await Promise.all(
      promptNames.map(name => getCached<{ name: string; content: string; updatedAt: string; updatedBy: string }>(`admin-prompt:${name}`))
    );

    const prompts = promptNames.map((name, i) => ({
      name,
      ...PROMPT_REGISTRY[name],
      override: overrides[i] || null,
      hasOverride: !!overrides[i],
    }));

    return NextResponse.json({ prompts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load prompts' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { name, content } = await request.json();

    if (!name || !PROMPT_REGISTRY[name]) {
      return NextResponse.json({ error: 'Invalid prompt name' }, { status: 400 });
    }

    if (content === null || content === undefined) {
      // Delete override (reset to default)
      // Set empty value with short TTL to effectively delete
      await setCached(`admin-prompt:${name}`, null, 1);
      return NextResponse.json({ success: true, action: 'reset' });
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content must be a non-empty string' }, { status: 400 });
    }

    await setCached(`admin-prompt:${name}`, {
      name,
      content: content.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'superbot',
    }, PROMPT_TTL);

    return NextResponse.json({ success: true, action: 'saved' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save prompt' },
      { status: 500 }
    );
  }
}
