'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ModalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error('[narrative-modal] crash:', error);
  }, [error]);

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) router.back(); }}>
      <div className="modal-content">
        <button className="modal-close" onClick={() => router.back()}>×</button>
        <div className="modal-section">
          <div className="modal-section-title">⚠ COULDN&apos;T LOAD NARRATIVE</div>
          <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
            Something broke while rendering this narrative analysis. The site is otherwise fine.
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
