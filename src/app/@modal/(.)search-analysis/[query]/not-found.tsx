'use client';

import { useRouter } from 'next/navigation';

export default function SearchModalNotFound() {
  const router = useRouter();
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) router.back(); }}>
      <div className="modal-content">
        <button className="modal-close" onClick={() => router.back()}>×</button>
        <div className="modal-section">
          <div className="modal-section-title">⚠ ANALYSIS NOT YET AVAILABLE</div>
          <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
            This search hasn&apos;t been analyzed yet, or the analysis aged out.
            Usually clears after the next pipeline run.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="dossier-link" onClick={() => router.back()}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}
