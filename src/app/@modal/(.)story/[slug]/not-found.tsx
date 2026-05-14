'use client';

import { useRouter } from 'next/navigation';

export default function StoryModalNotFound() {
  const router = useRouter();
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) router.back(); }}>
      <div className="modal-content">
        <button className="modal-close" onClick={() => router.back()}>×</button>
        <div className="modal-section">
          <div className="modal-section-title">⚠ STORY NOT FOUND</div>
          <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
            This story isn&apos;t in the archive. It may have aged out or the link may be stale.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="dossier-link" onClick={() => router.back()}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}
