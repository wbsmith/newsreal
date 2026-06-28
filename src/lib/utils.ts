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

// Unwrap [REDACTED:revealed text] markup to plain text for non-interactive
// contexts (meta descriptions, OG tags) where the click-to-reveal blackbar can't
// render. UI components use RedactedText instead to render the blackbar.
export function stripRedaction(text: string | undefined): string {
  return (text || '').replace(/\[REDACTED:(.*?)\]/g, '$1');
}

// Human age computed live from a timestamp, coarsening for older items. Use this
// at render time (not a value frozen at index time) so age stays honest, and
// older stories read as "over a week/month ago" rather than a precise-but-stale
// timestamp.
export function displayAge(dateStr: string | undefined, fallback = 'recently'): string {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return fallback;

  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day} days ago`;
  if (day < 30) return 'over a week ago';
  if (day < 365) return 'over a month ago';
  return 'over a year ago';
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
