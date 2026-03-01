import { formatDistanceToNow } from 'date-fns';
import { BiasTag, BiasClass, StoryBiasTag } from '@/types';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function relativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'recently';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'recently';
  }
}

const BIAS_CLASS_MAP: Record<string, BiasClass> = {
  'LEAN LEFT': 'left',
  'LEAN RIGHT': 'right',
  'ESTABLISHMENT': 'establishment',
  'CENTER-ESTABLISHMENT': 'center',
  'ANTI-ESTABLISHMENT': 'right',
  'UNREPORTED': 'establishment',
};

export function mapBiasTag(tag: string): StoryBiasTag {
  const normalized = tag.toUpperCase().trim() as BiasTag;
  return {
    label: normalized,
    class: BIAS_CLASS_MAP[normalized] || 'center',
  };
}

export function parseClaudeJSON<T>(raw: string): T | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
