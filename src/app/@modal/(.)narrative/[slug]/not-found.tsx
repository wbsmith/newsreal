'use client';

import { useRouter } from 'next/navigation';

/**
 * Rendered inside the @modal slot when the intercepted narrative route
 * calls notFound() — typically because the narrative-analysis cache
 * entry is missing (parse failed during Step 7b, or the slug aged out).
 *
 * Without this file, Next.js falls back to the standalone /narrative/[slug]
 * not-found page, which exits the intercept and breaks back navigation.
 */
export default function NarrativeModalNotFound() {
  const router = useRouter();
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) router.back(); }}>
      <div className="modal-content">
        <button className="modal-close" onClick={() => router.back()}>×</button>
        <div className="modal-section">
          <div className="modal-section-title">⚠ NARRATIVE NOT YET ANALYZED</div>
          <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
            This narrative is in the dashboard but its deep-dive analysis hasn&apos;t been cached yet.
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
