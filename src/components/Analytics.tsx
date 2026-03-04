'use client';

import { useEffect } from 'react';

export default function Analytics() {
  useEffect(() => {
    const path = window.location.pathname;
    const referrer = document.referrer || '';

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, referrer }),
    }).catch(() => {});
  }, []);

  return null;
}
