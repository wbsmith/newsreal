import OpenAI from 'openai';

// ─── Types ───

export interface ModelInfo {
  id: string;
  type: 'llm' | 'vlm' | 'embeddings';
  arch: string;
  quantization: string;
  state: 'loaded' | 'not-loaded';
  maxContextLength: number;
  loadedContextLength?: number;
  capabilities: string[];
  compatibilityType: string;
  publisher: string;
}

export interface LoadConfig {
  contextLength: number;
  evalBatchSize?: number;
  flashAttention?: boolean;
}

export interface PromptTemplate {
  system?: string;
  user: string;
}

export interface CompleteParams {
  prompt: string;
  vars: Record<string, string>;
  effort: number;
  model?: (input: string) => Promise<string>;
  tag?: string;
}

export interface CompleteResult {
  content: string;
  model: string;
  tokens: { in: number; out: number };
  elapsed: number;
}

interface CallRecord {
  model: string;
  tag?: string;
  tokensIn: number;
  tokensOut: number;
  elapsed: number;
  timestamp: number;
}

interface RouterConfig {
  baseUrl?: string;
  apiKey?: string;
  overrides?: Record<string, { effort: [number, number]; contextLength?: number }>;
  trackTokens?: boolean;
}

// ─── ModelRouter ───

export class ModelRouter {
  private client: OpenAI;
  private baseHost: string;
  private models: ModelInfo[] = [];
  private prompts = new Map<string, PromptTemplate>();
  private records: CallRecord[] = [];
  private tracking: boolean;

  private preExisting = new Set<string>();
  private launched = new Map<string, string>(); // model id → instance_id
  private overrides: Record<string, { effort: [number, number]; contextLength?: number }>;

  private constructor(config: RouterConfig) {
    const baseUrl = config.baseUrl || process.env.LLM_BASE_URL || 'http://localhost:1234/v1';
    this.baseHost = baseUrl.replace(/\/v1\/?$/, '');
    this.client = new OpenAI({ baseURL: baseUrl, apiKey: config.apiKey || process.env.LLM_API_KEY || 'not-needed' });
    this.tracking = config.trackTokens ?? (process.env.TRACK_TOKENS === 'true');
    this.overrides = config.overrides || {};
  }

  static async create(config: RouterConfig = {}): Promise<ModelRouter> {
    const router = new ModelRouter(config);
    await router.discover();
    return router;
  }

  // ─── Discovery ───

  private async discover(): Promise<void> {
    const res = await fetch(`${this.baseHost}/api/v0/models`);
    if (!res.ok) throw new Error(`Model discovery failed: ${res.status}`);
    const data = await res.json() as { data: any[] };

    this.models = data.data.map((m: any) => ({
      id: m.id,
      type: m.type === 'embeddings' ? 'embeddings' : m.type === 'vlm' ? 'vlm' : 'llm',
      arch: m.arch,
      quantization: m.quantization,
      state: m.state,
      maxContextLength: m.max_context_length,
      loadedContextLength: m.loaded_context_length,
      capabilities: m.capabilities || [],
      compatibilityType: m.compatibility_type,
      publisher: m.publisher,
    }));

    for (const m of this.models) {
      if (m.state === 'loaded') this.preExisting.add(m.id);
    }
  }

  // ─── Model Lifecycle ───

  async ensureLoaded(modelId: string, opts?: Partial<LoadConfig>): Promise<LoadConfig> {
    const model = this.models.find(m => m.id === modelId);
    if (!model) throw new Error(`Model "${modelId}" not found on server`);

    if (model.state === 'loaded') {
      return { contextLength: model.loadedContextLength || model.maxContextLength };
    }

    const body: Record<string, any> = {
      model: modelId,
      echo_load_config: true,
    };
    if (opts?.contextLength) body.context_length = opts.contextLength;
    if (opts?.evalBatchSize) body.eval_batch_size = opts.evalBatchSize;
    if (opts?.flashAttention !== undefined) body.flash_attention = opts.flashAttention;
    if (model.compatibilityType === 'gguf' && opts?.flashAttention === undefined) {
      body.flash_attention = true;
    }

    const res = await fetch(`${this.baseHost}/api/v1/models/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to load model "${modelId}": ${err}`);
    }

    const result = await res.json() as any;
    model.state = 'loaded';
    model.loadedContextLength = result.load_config?.context_length || opts?.contextLength;
    this.launched.set(modelId, result.instance_id || modelId);

    return {
      contextLength: model.loadedContextLength || model.maxContextLength,
      evalBatchSize: result.load_config?.eval_batch_size,
      flashAttention: result.load_config?.flash_attention,
    };
  }

  async unload(modelId: string): Promise<void> {
    const instanceId = this.launched.get(modelId);
    if (!instanceId) return;

    await fetch(`${this.baseHost}/api/v1/models/unload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId }),
    });

    const model = this.models.find(m => m.id === modelId);
    if (model) model.state = 'not-loaded';
    this.launched.delete(modelId);
  }

  async teardown(): Promise<void> {
    for (const id of this.launched.keys()) {
      await this.unload(id);
    }
  }

  // ─── Model Selection ───

  private selectModel(effort: number, type: 'llm' | 'embeddings' = 'llm'): ModelInfo {
    // Check overrides first
    for (const [id, cfg] of Object.entries(this.overrides)) {
      if (effort >= cfg.effort[0] && effort <= cfg.effort[1]) {
        const m = this.models.find(m => m.id === id);
        if (m) return m;
      }
    }

    // Filter to matching type (vlm can serve as llm)
    const candidates = this.models.filter(m =>
      type === 'embeddings' ? m.type === 'embeddings' : (m.type === 'llm' || m.type === 'vlm')
    );

    if (candidates.length === 0) throw new Error(`No ${type} models available`);

    // Rank by capability score (rough: quant precision × arch size heuristic)
    const scored = candidates.map(m => ({
      model: m,
      score: this.capabilityScore(m),
    })).sort((a, b) => a.score - b.score);

    // Map effort to index in sorted list
    const idx = Math.min(Math.floor(effort * scored.length), scored.length - 1);
    return scored[idx].model;
  }

  private capabilityScore(m: ModelInfo): number {
    const quantScores: Record<string, number> = {
      'Q4_K_M': 4, '4bit': 4, 'Q5_K_M': 5, 'Q6_K': 6, 'Q8_0': 8, 'f16': 16,
    };
    const qScore = quantScores[m.quantization] || 4;

    // Rough param count heuristic from known architectures
    const archScores: Record<string, number> = {
      'llama': 70, 'gemma4': 31, 'qwen3next': 30, 'nemotron_h_moe': 8, 'nomic-bert': 0.1,
    };
    const aScore = archScores[m.arch] || 10;

    return qScore * aScore;
  }

  private inferMaxTokens(effort: number, model: ModelInfo): number {
    const ctx = model.loadedContextLength || model.maxContextLength;
    // Reserve input headroom: lower effort → smaller output budget
    // effort 0.1 → ~10% of context for output
    // effort 0.9 → ~40% of context for output (capped at reasonable limits)
    const ratio = 0.05 + effort * 0.35;
    const raw = Math.floor(ctx * ratio);
    // Practical caps: don't let a 131K context model try to generate 50K tokens
    const caps: Record<string, number> = { '0.2': 2048, '0.5': 4096, '0.8': 8192, '1.0': 16384 };
    const capKey = Object.keys(caps).reverse().find(k => effort <= parseFloat(k)) || '1.0';
    return Math.min(raw, caps[capKey]);
  }

  // ─── Prompt Registry ───

  registerPrompt(name: string, template: PromptTemplate): void {
    this.prompts.set(name, template);
  }

  registerPrompts(templates: Record<string, PromptTemplate>): void {
    for (const [name, tpl] of Object.entries(templates)) {
      this.prompts.set(name, tpl);
    }
  }

  private resolvePrompt(name: string, vars: Record<string, string>): { system?: string; user: string } {
    const tpl = this.prompts.get(name);
    if (!tpl) throw new Error(`Prompt "${name}" not found in registry`);

    const hydrate = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
    return {
      system: tpl.system ? hydrate(tpl.system) : undefined,
      user: hydrate(tpl.user),
    };
  }

  // ─── Core Dispatch ───

  async complete(params: CompleteParams): Promise<CompleteResult> {
    const { prompt: promptKey, vars, effort, model: fnOverride, tag } = params;
    const resolved = this.resolvePrompt(promptKey, vars);
    const start = Date.now();

    // Function handle override — bypass LLM entirely
    if (fnOverride) {
      const input = resolved.system ? `${resolved.system}\n\n${resolved.user}` : resolved.user;
      const content = await fnOverride(input);
      const elapsed = Date.now() - start;
      const record: CallRecord = { model: `fn:${fnOverride.name || 'anonymous'}`, tag, tokensIn: 0, tokensOut: 0, elapsed, timestamp: start };
      if (this.tracking) this.records.push(record);
      return { content, model: record.model, tokens: { in: 0, out: 0 }, elapsed };
    }

    // LLM path
    const selected = this.selectModel(effort);
    await this.ensureLoaded(selected.id);

    const maxTokens = this.inferMaxTokens(effort, selected);
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (resolved.system) messages.push({ role: 'system', content: resolved.system });
    messages.push({ role: 'user', content: resolved.user });

    const response = await this.client.chat.completions.create({
      model: selected.id,
      max_tokens: maxTokens,
      messages,
    });

    const elapsed = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? '';
    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;

    if (this.tracking) {
      this.records.push({ model: selected.id, tag, tokensIn, tokensOut, elapsed, timestamp: start });
    }

    return { content, model: selected.id, tokens: { in: tokensIn, out: tokensOut }, elapsed };
  }

  async embed(text: string): Promise<number[]> {
    const selected = this.selectModel(0, 'embeddings');
    await this.ensureLoaded(selected.id);

    const start = Date.now();
    const response = await this.client.embeddings.create({
      model: selected.id,
      input: text,
      encoding_format: 'float',
    });
    const elapsed = Date.now() - start;
    const vec = response.data[0]?.embedding ?? [];

    if (this.tracking) {
      this.records.push({ model: selected.id, tag: 'embed', tokensIn: response.usage?.prompt_tokens ?? 0, tokensOut: 0, elapsed, timestamp: start });
    }
    return vec;
  }

  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];
    const selected = this.selectModel(0, 'embeddings');
    await this.ensureLoaded(selected.id);

    const start = Date.now();
    const response = await this.client.embeddings.create({
      model: selected.id,
      input: texts,
      encoding_format: 'float',
    });
    const elapsed = Date.now() - start;

    if (this.tracking) {
      this.records.push({ model: selected.id, tag: 'embed-batch', tokensIn: response.usage?.prompt_tokens ?? 0, tokensOut: 0, elapsed, timestamp: start });
    }
    return texts.map((_, i) => response.data[i]?.embedding ?? null);
  }

  // ─── Telemetry ───

  printReport(): void {
    if (this.records.length === 0) {
      console.log('\n═══ TOKEN USAGE REPORT: No calls recorded ═══\n');
      return;
    }

    console.log('\n═══ TOKEN USAGE REPORT ═══');

    // Group by model+tag
    const groups = new Map<string, CallRecord[]>();
    for (const r of this.records) {
      const key = r.tag ? `${r.model} [${r.tag}]` : r.model;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    let totalIn = 0, totalOut = 0, totalTime = 0;

    for (const [key, calls] of groups) {
      const n = calls.length;
      const sumIn = calls.reduce((s, c) => s + c.tokensIn, 0);
      const sumOut = calls.reduce((s, c) => s + c.tokensOut, 0);
      const sumTime = calls.reduce((s, c) => s + c.elapsed, 0);
      const maxIn = Math.max(...calls.map(c => c.tokensIn));
      const maxOut = Math.max(...calls.map(c => c.tokensOut));
      const minIn = Math.min(...calls.map(c => c.tokensIn));
      const minOut = Math.min(...calls.map(c => c.tokensOut));

      totalIn += sumIn;
      totalOut += sumOut;
      totalTime += sumTime;

      console.log(`\n  ${key} (${n} calls, ${(sumTime / 1000).toFixed(1)}s total):`);
      console.log(`    Input:  avg=${Math.round(sumIn / n)}  min=${minIn}  max=${maxIn}  total=${sumIn}`);
      console.log(`    Output: avg=${Math.round(sumOut / n)}  min=${minOut}  max=${maxOut}  total=${sumOut}`);
      console.log(`    Time:   avg=${Math.round(sumTime / n)}ms  min=${Math.min(...calls.map(c => c.elapsed))}ms  max=${Math.max(...calls.map(c => c.elapsed))}ms`);
    }

    console.log(`\n  TOTAL: ${totalIn} tokens in, ${totalOut} tokens out, ${(totalTime / 1000).toFixed(1)}s wall time across ${this.records.length} calls`);
    console.log('══════════════════════════\n');
  }

  // ─── Introspection ───

  getModels(): ModelInfo[] {
    return [...this.models];
  }

  getLoadedModels(): ModelInfo[] {
    return this.models.filter(m => m.state === 'loaded');
  }
}
