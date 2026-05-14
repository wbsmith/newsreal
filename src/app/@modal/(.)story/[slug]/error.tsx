'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Error boundary for the intercepted story modal. If the page or any
 * component below it throws (e.g. malformed data crashes a child),
 * render a clean failure pane with a working close button instead of
 * dragging the whole app into a white-screen state.
 */
export default function ModalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error('[story-modal] crash:', error);
  }, [error]);

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) router.back(); }}>
      <div className="modal-content">
        <button className="modal-close" onClick={() => router.back()}>×</button>
        <div className="modal-section">
          <div className="modal-section-title">⚠ COULDN&apos;T LOAD STORY</div>
          <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
            Something broke while rendering this story&apos;s analysis. The site itself is fine — back works,
            other stories should load.
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
            {error.message || 'Unknown error'}
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="dossier-link" onClick={reset}>RETRY</button>
            <button className="dossier-link" onClick={() => router.back()}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}
