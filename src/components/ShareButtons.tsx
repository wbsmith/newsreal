'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  slug: string;
  headline: string;
}

export default function ShareButtons({ slug, headline }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const storyUrl = `${siteUrl}/story/${slug}`;
  const shareText = `${headline} — NewsReal.ai`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(storyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = storyUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleTwitter() {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(storyUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=550,height=420');
  }

  function handleReddit() {
    const url = `https://reddit.com/submit?url=${encodeURIComponent(storyUrl)}&title=${encodeURIComponent(headline)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: headline, text: shareText, url: storyUrl });
      } catch {
        // User cancelled — ignore
      }
    }
  }

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="share-buttons">
      <button className="share-btn" onClick={handleCopy}>
        [{copied ? 'COPIED!' : 'COPY LINK'}]
      </button>
      <button className="share-btn" onClick={handleTwitter}>
        [X/TWITTER]
      </button>
      <button className="share-btn" onClick={handleReddit}>
        [REDDIT]
      </button>
      {hasNativeShare && (
        <button className="share-btn" onClick={handleNativeShare}>
          [SHARE...]
        </button>
      )}
    </div>
  );
}
