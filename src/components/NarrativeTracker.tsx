'use client';

import { useState } from 'react';
import { Narrative, NarrativeAnalysis } from '@/types';
import NarrativeAnalysisModal from './NarrativeAnalysisModal';

interface NarrativeTrackerProps {
  narratives: Narrative[];
}

export default function NarrativeTracker({ narratives }: NarrativeTrackerProps) {
  const [analysis, setAnalysis] = useState<NarrativeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  async function handleNarrativeClick(narrative: Narrative) {
    if (!narrative.slug) return;

    setActiveSlug(narrative.slug);
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch(`/api/narrative?slug=${encodeURIComponent(narrative.slug)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Analysis failed (${res.status})`);
      }
      const data: NarrativeAnalysis = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Narrative analysis failed');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setAnalysis(null);
    setLoading(false);
    setError(null);
    setActiveSlug(null);
  }

  return (
    <div className="sidebar-panel">
      <div className="panel-header">
        <span className="icon">{'\uD83D\uDCE1'}</span>
        <h3>Dominant Narratives</h3>
      </div>
      <div className="panel-body">
        {narratives.map((n, i) => (
          <div
            key={i}
            className={`narrative-item narrative-item-clickable ${activeSlug === n.slug ? 'narrative-item-active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => handleNarrativeClick(n)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNarrativeClick(n);
              }
            }}
          >
            <span className="narrative-rank">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <div
                className="narrative-text"
                dangerouslySetInnerHTML={{ __html: n.text }}
              />
              <div className="narrative-heat">
                {n.heat}
                {activeSlug === n.slug && loading && (
                  <span className="analyzing-tag"> [DECODING...]</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <NarrativeAnalysisModal
        analysis={analysis}
        loading={loading}
        error={error}
        onClose={handleClose}
      />
    </div>
  );
}
