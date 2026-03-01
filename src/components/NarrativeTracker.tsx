'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { Narrative, NarrativeAnalysis } from '@/types';
import NarrativeAnalysisModal from './NarrativeAnalysisModal';

export interface NarrativeTrackerHandle {
  analyzeNarrative: (slug: string) => void;
}

interface NarrativeTrackerProps {
  narratives: Narrative[];
}

const NarrativeTracker = forwardRef<NarrativeTrackerHandle, NarrativeTrackerProps>(
  function NarrativeTracker({ narratives }, ref) {
  const [analysis, setAnalysis] = useState<NarrativeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  async function fetchNarrativeAnalysis(slug: string) {
    setActiveSlug(slug);
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch(`/api/narrative?slug=${encodeURIComponent(slug)}`);
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

  function handleNarrativeClick(narrative: Narrative) {
    if (!narrative.slug) return;
    fetchNarrativeAnalysis(narrative.slug);
  }

  useImperativeHandle(ref, () => ({
    analyzeNarrative(slug: string) {
      const narrative = narratives.find((n) => n.slug === slug);
      if (narrative) {
        handleNarrativeClick(narrative);
      } else {
        fetchNarrativeAnalysis(slug);
      }
    },
  }));

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
        {narratives.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-message">SCANNING TRANSMISSION PATTERNS...</div>
          </div>
        ) : narratives.map((n, i) => (
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
});

export default NarrativeTracker;
