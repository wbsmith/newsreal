'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface ShareButtonProps {
  url: string;
  title: string;
}

export default function ShareButton({ url, title }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} — NewsReal.ai`, url });
      } catch {
        // User cancelled
      }
    }
    setOpen(false);
  }

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="share-button-wrapper" ref={wrapperRef}>
      <button
        className="share-btn share-btn-icon"
        onClick={() => setOpen(!open)}
        title={copied ? 'Copied!' : 'Share'}
      >
        <Image
          src="/icon.png"
          alt=""
          width={24}
          height={24}
          className="share-icon"
        />
        <span>{copied ? 'COPIED!' : 'SHARE'}</span>
      </button>
      {open && (
        <div className="share-dropdown">
          <button className="share-dropdown-item" onClick={handleCopy}>
            COPY LINK
          </button>
          {hasNativeShare && (
            <button className="share-dropdown-item" onClick={handleNativeShare}>
              SHARE...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
