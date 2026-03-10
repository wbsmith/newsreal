import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export interface ScrapedArticle {
  title: string;
  content: string;
  siteName: string;
}

export async function scrapeArticle(url: string): Promise<ScrapedArticle> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsReal.ai/1.0; Media Analysis)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      throw new Error('Could not extract article content');
    }

    // Extract site name from URL hostname
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    return {
      title: article.title || hostname,
      content: article.textContent.slice(0, 5000),
      siteName: article.siteName || hostname,
    };
  } finally {
    clearTimeout(timeout);
  }
}
