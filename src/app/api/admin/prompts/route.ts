import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const PROMPT_TTL = 315360000; // ~10 years

// Registry of all editable prompts with descriptions and hardcoded defaults from Lambda
const PROMPT_REGISTRY: Record<string, { description: string; type: 'system' | 'rubric' | 'instruction'; defaultText: string }> = {
  'analysis-system': {
    description: 'Deep analysis system prompt — tone, voice, behavioral instructions (used for Step 5 deep analysis)',
    type: 'system',
    defaultText: `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism for each news story.

STYLE GUIDELINES:
- Be equally skeptical of all political sides
- Always follow the money
- Timing is never coincidental — always note what else happened the same day
- Name specific dollar amounts, even if estimated/speculative
- Reference specific entities, PACs, lobbying groups, contractors
- The tone is: smart, cynical, deeply informed, conspiratorial but self-aware
- Everything you generate will be clearly labeled as AI speculation
- You are not being neutral — you are being provocatively analytical
- Do NOT hedge with "it's important to note" or "to be fair" — be direct
- Respond ONLY in valid JSON. No markdown, no commentary.`,
  },
  'obfuscation-system': {
    description: 'Obfuscation detector system prompt — identifies stories buried by the news cycle',
    type: 'system',
    defaultText: `You are the NewsReal.ai Obfuscation Detector. Your job is to identify stories that are being BURIED by the current news cycle. Respond ONLY in valid JSON.`,
  },
  'narrative-system': {
    description: 'Narrative tracker system prompt — detects coordinated messaging patterns',
    type: 'system',
    defaultText: `You are the NewsReal.ai Narrative Tracker. You detect coordinated messaging patterns across media outlets. Respond ONLY in valid JSON.`,
  },
  'ticker-system': {
    description: 'Ticker alert generator system prompt',
    type: 'system',
    defaultText: `You generate ticker alerts for the NewsReal.ai scrolling banner. Respond ONLY in valid JSON.`,
  },
  'suppressed-system': {
    description: 'Suppressed searches generator — "forbidden knowledge" search queries',
    type: 'system',
    defaultText: `You generate "forbidden knowledge" search queries for NewsReal.ai. Respond ONLY in valid JSON.`,
  },
  'narrative-analysis-system': {
    description: 'Deep narrative analysis system prompt (Step 7b) — used when precomputing narrative deep dives',
    type: 'system',
    defaultText: `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism. Be equally skeptical of all political sides. Always follow the money. Be direct. Be bold. Respond ONLY in valid JSON. No markdown, no commentary.`,
  },
  'search-analysis-system': {
    description: 'Search analysis system prompt (Step 7c) — used when analyzing suppressed search results',
    type: 'system',
    defaultText: `You are the NewsReal.ai analysis engine. Your job is to generate provocative, attention-grabbing media criticism. Be equally skeptical of all political sides. Always follow the money. Be direct. Be bold. Respond ONLY in valid JSON. No markdown, no commentary.`,
  },
  'classify-system': {
    description: 'Classification instruction block — categories, bias tags, manipulation scoring rubric (sent as user message to Haiku)',
    type: 'instruction',
    defaultText: `[This is the user-message instruction template for Haiku classification. Variables: {headline}, {summary/text}, {source}. Override replaces the full instruction block.]

Classify this news story and score its manipulation level. Respond ONLY in JSON, no other text.

MANIPULATION INDEX — score each dimension 0-20, then sum for total (0-100):
1. EMOTIONAL MANIPULATION (0-20): Loaded language, fear/outrage triggers, urgency framing, identity appeals
2. SOURCE TRANSPARENCY (0-20): Named vs anonymous sources, verifiability of claims
3. FRAMING BIAS (0-20): How hard the piece pushes a single interpretation
4. SELECTIVE OMISSION (0-20): Missing financial context, timing, history, counter-evidence
5. HEADLINE ACCURACY (0-20): Does headline match the actual content?`,
  },
  'analysis-rubric': {
    description: 'Manipulation scoring rubric — 5 dimensions, 0-20 each (embedded in the analysis user prompt)',
    type: 'rubric',
    defaultText: `MANIPULATION INDEX RUBRIC — Score each dimension independently (0-20), then sum for the total (0-100). Provide a 1-sentence justification for each score.

1. EMOTIONAL MANIPULATION (0-20): How much is the language designed to trigger emotion over thought?
   0-5: Neutral, clinical tone. Facts stated plainly.
   6-10: Some charged language but mostly restrained.
   11-15: Frequent emotional triggers — urgency, outrage, fear, identity appeals.
   16-20: Pervasive rage-bait. Every sentence is an emotional hook.

2. SOURCE TRANSPARENCY (0-20): Can the reader verify the claims?
   0-5: Named sources, linked documents, verifiable data.
   6-10: Mix of named/unnamed; most claims checkable.
   11-15: Key claims rest on anonymous attribution.
   16-20: Major assertions unattributed or circular sourcing.

3. FRAMING BIAS (0-20): How hard is the piece pushing one interpretation?
   0-5: Multiple perspectives, counter-evidence acknowledged.
   6-10: Discernible lean but opposing views mentioned.
   11-15: Single-frame narrative, opposing views dismissed or strawmanned.
   16-20: Pure advocacy presented as reporting.

4. SELECTIVE OMISSION (0-20): What critical context is missing?
   0-5: Comprehensive context — financial ties, history, counter-evidence present.
   6-10: Minor gaps, nothing that changes the core picture.
   11-15: Significant missing context (funding, timing, relevant history).
   16-20: Critical information absent that would change the reader's conclusion.

5. HEADLINE ACCURACY (0-20): Does the headline represent the content?
   0-5: Headline is a fair summary.
   6-10: Slight exaggeration or emphasis shift.
   11-15: Headline overstates or implies unsupported causation.
   16-20: Headline actively misleads relative to content.`,
  },
  'narrative-rubric': {
    description: 'Coherence scoring rubric — 4 dimensions, 0-25 each (embedded in the narrative user prompt)',
    type: 'rubric',
    defaultText: `COHERENCE RUBRIC:
1. LEXICAL ALIGNMENT (0-25): Are outlets using the same keywords, phrases, and talking points?
   0-8: Same topic, different language. Normal independent coverage.
   9-16: Shared terminology but distinct framing.
   17-25: Near-identical phrasing across outlets. Same metaphors, same adjectives. Memo energy.

2. FRAME UNIFORMITY (0-25): Are outlets applying the same interpretive lens?
   0-8: Diverse interpretations of the same events.
   9-16: Similar conclusions but different reasoning paths.
   17-25: Uniform narrative arc. Same heroes, same villains, same prescribed response.

3. SOURCE CONVERGENCE (0-25): Are outlets citing the same experts/studies/data?
   0-8: Diverse sourcing, different experts and data sets.
   9-16: Some overlap in key sources.
   17-25: Same 2-3 sources dominating across all outlets.

4. COUNTER-NARRATIVE ABSENCE (0-25): How few outlets are offering dissent?
   0-8: Healthy dissent, multiple outlets pushing back.
   9-16: Some dissent but minority position.
   17-25: Near-total uniformity, no major outlet breaking ranks.`,
  },
};

export async function GET() {
  try {
    const promptNames = Object.keys(PROMPT_REGISTRY);
    const overrides = await Promise.all(
      promptNames.map(name => getCached<{ name: string; content: string; updatedAt: string; updatedBy: string }>(`admin-prompt:${name}`))
    );

    const prompts = promptNames.map((name, i) => {
      const reg = PROMPT_REGISTRY[name];
      return {
        name,
        description: reg.description,
        type: reg.type,
        defaultText: reg.defaultText,
        override: overrides[i] || null,
        hasOverride: !!overrides[i],
      };
    });

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
