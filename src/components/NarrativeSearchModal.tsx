'use client';

import { useState } from 'react';
import { NarrativeAnalysis } from '@/types';
import AnalysisModal from './AnalysisModal';
import NarrativeAnalysisSections from './NarrativeAnalysisSections';

interface NarrativeSearchModalProps {
  open: boolean;
  onClose: () => void;
  initialTerm?: string;
}

type Phase = 'input' | 'loading' | 'results';

const LOADING_STEPS = [
  'SCANNING COVERAGE...',
  'CLUSTERING OUTLETS...',
  'DETECTING REPEATED PHRASING...',
  'DECODING NARRATIVE...',
];

export default function NarrativeSearchModal({ open, onClose, initialTerm = '' }: NarrativeSearchModalProps) {
  const [term, setTerm] = useState(initialTerm);
  const [phase, setPhase] = useState<Phase>('input');
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NarrativeAnalysis | null>(null);
  const [articleCount, setArticleCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const reset = () => {
    setPhase('input');
    setError(null);
    setResult(null);
    setArticleCount(0);
    setLoadingStep(0);
    setPublishing(false);
    setPublished(false);
  };

  const handleClose = () => {
    reset();
    setTerm('');
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setPhase('loading');
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 3000);

    try {
      const res = await fetch('/api/narrative-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: term.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Narrative build failed');

      setResult(data.narrative);
      setArticleCount(data.articleCount ?? 0);
      setPhase('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Narrative build failed');
      setPhase('input');
    } finally {
      clearInterval(stepInterval);
    }
  };

  const handlePublish = async () => {
    if (!result || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/narrative-search/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative: result }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Publish failed');
      }
      setPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const canSubmit = term.trim().length >= 3;

  if (phase === 'input') {
    return (
      <AnalysisModal open={open} onClose={handleClose} disclaimer="Build a dominant-narrative read from live cross-outlet coverage of any term. Results are speculative analysis.">
        <div className="modal-section">
          <div className="modal-section-title">
            {'⌖'} BUILD NARRATIVE FROM SEARCH TERM
          </div>
          <input
            type="text"
            className="analyze-input"
            placeholder='e.g. "godless communists"'
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
          />
          {error && <p className="analyze-error">{error}</p>}
          <button className="analyze-submit" disabled={!canSubmit} onClick={handleSubmit}>
            BUILD DOMINANT NARRATIVE
          </button>
        </div>
      </AnalysisModal>
    );
  }

  if (phase === 'loading') {
    return (
      <AnalysisModal
        open={open}
        onClose={handleClose}
        loading
        loadingText={LOADING_STEPS[loadingStep]}
        loadingSubtext="Fetching live coverage — this typically takes 10-20 seconds"
      />
    );
  }

  const narrative = result!;
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const shareUrl = `${siteUrl}/narrative/${narrative.slug}`;
  const plainText = narrative.narrativeText.replace(/<[^>]*>/g, '');

  const header = (
    <>
      <div className="story-meta">
        <span className="story-source">NARRATIVE DECODE</span>
        <span className="story-time">JUST BUILT</span>
      </div>
      <h2 className="story-headline">
        <span dangerouslySetInnerHTML={{ __html: narrative.narrativeText }} />
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--accent-cyan)',
          letterSpacing: '1px',
          marginTop: '8px',
        }}
      >
        COHERENCE: {narrative.coherenceScore}% / {narrative.outletsInvolved.length} OUTLETS / {articleCount} ARTICLES
      </p>
    </>
  );

  return (
    <AnalysisModal
      open={open}
      onClose={handleClose}
      header={header}
      shareUrl={published ? shareUrl : undefined}
      shareTitle={plainText}
    >
      <NarrativeAnalysisSections analysis={narrative} />

      <div className="modal-section" style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {!published ? (
          <button className="dossier-link publish-btn" onClick={handlePublish} disabled={publishing}>
            {publishing ? '[PUBLISHING...]' : '[PUBLISH TO SITE]'}
          </button>
        ) : (
          <a href={`/narrative/${narrative.slug}`} className="dossier-link published">
            [PUBLISHED — VIEW DECODE]
          </a>
        )}
        <button className="dossier-link" onClick={reset}>
          [BUILD ANOTHER]
        </button>
      </div>
    </AnalysisModal>
  );
}
