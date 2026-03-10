'use client';

import { useState } from 'react';
import { Story } from '@/types';
import BiasTag from './BiasTag';
import ManipulationMeter from './ManipulationMeter';
import RedactedText from './RedactedText';
import AnalysisModal from './AnalysisModal';

interface AnalyzeArticleModalProps {
  open: boolean;
  onClose: () => void;
}

type InputMode = 'url' | 'text';
type Phase = 'input' | 'loading' | 'results';

const LOADING_STEPS = [
  'SCRAPING ARTICLE...',
  'CLASSIFYING CONTENT...',
  'RUNNING DEEP ANALYSIS...',
  'DECODING NARRATIVES...',
];

export default function AnalyzeArticleModal({ open, onClose }: AnalyzeArticleModalProps) {
  const [mode, setMode] = useState<InputMode>('url');
  const [urlValue, setUrlValue] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Story | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const reset = () => {
    setPhase('input');
    setError(null);
    setResult(null);
    setLoadingStep(0);
    setPublishing(false);
    setPublished(false);
  };

  const handleClose = () => {
    reset();
    setUrlValue('');
    setTitleValue('');
    setTextValue('');
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setPhase('loading');
    setLoadingStep(0);

    // Animate loading steps
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 3000);

    try {
      const body = mode === 'url'
        ? { url: urlValue.trim() }
        : { text: textValue.trim(), title: titleValue.trim() || undefined };

      const res = await fetch('/api/analyze-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data.story);
      setPhase('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setPhase('input');
    } finally {
      clearInterval(stepInterval);
    }
  };

  const handlePublish = async () => {
    if (!result || publishing) return;
    setPublishing(true);

    try {
      const res = await fetch('/api/analyze-article/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: result }),
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

  const canSubmit = mode === 'url'
    ? urlValue.trim().length > 0
    : textValue.trim().length > 50;

  // Input phase — render custom content (not using AnalysisModal's loading/error)
  if (phase === 'input') {
    return (
      <AnalysisModal open={open} onClose={handleClose} disclaimer="Submit any article for AI-powered media criticism. Results are speculative analysis.">
        <div className="modal-section">
          <div className="modal-section-title">
            {'\u2316'} SUBMIT ARTICLE FOR ANALYSIS
          </div>

          <div className="analyze-tabs">
            <button
              className={`analyze-tab ${mode === 'url' ? 'active' : ''}`}
              onClick={() => setMode('url')}
            >
              URL
            </button>
            <button
              className={`analyze-tab ${mode === 'text' ? 'active' : ''}`}
              onClick={() => setMode('text')}
            >
              PASTE TEXT
            </button>
          </div>

          {mode === 'url' ? (
            <input
              type="url"
              className="analyze-input"
              placeholder="https://example.com/article..."
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
            />
          ) : (
            <>
              <input
                type="text"
                className="analyze-input"
                placeholder="Article title (optional)"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                style={{ marginBottom: '8px' }}
              />
              <textarea
                className="analyze-textarea"
                placeholder="Paste article text here (minimum 50 characters)..."
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                rows={8}
              />
            </>
          )}

          {error && (
            <p className="analyze-error">{error}</p>
          )}

          <button
            className="analyze-submit"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            DECODE THIS ARTICLE
          </button>
        </div>
      </AnalysisModal>
    );
  }

  // Loading phase
  if (phase === 'loading') {
    return (
      <AnalysisModal
        open={open}
        onClose={handleClose}
        loading
        loadingText={LOADING_STEPS[loadingStep]}
        loadingSubtext="This typically takes 10-20 seconds"
      />
    );
  }

  // Results phase
  const story = result!;
  const header = (
    <>
      <div className="story-meta">
        <span className="story-source">{story.source}</span>
        <span className="story-time">JUST ANALYZED</span>
        <BiasTag tag={story.biasTag} />
      </div>
      <h2 className="story-headline">{story.headline}</h2>
      <p className="story-summary" style={{ fontSize: '17px', marginTop: '8px' }}>
        {story.summary}
      </p>
      <ManipulationMeter score={story.manipulationScore} />
    </>
  );

  return (
    <AnalysisModal open={open} onClose={handleClose} header={header}>
      <div className="modal-section">
        <div className="modal-section-title">
          {'\u25C8'} AI DEEP ANALYSIS <span className="blink">{'\u258A'}</span>
        </div>
        <p className="analysis-text speculation">
          <RedactedText text={story.realAnalysis} />
        </p>
      </div>

      {story.deepDive && (
        <>
          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDCFA'} THE MAINSTREAM FRAME
            </div>
            <p className="analysis-text">{story.deepDive.mainstream}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDD13'} THE REAL STORY (SPECULATIVE)
            </div>
            <p className="analysis-text speculation">{story.deepDive.realStory}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\u2696\uFE0F'} BIAS BREAKDOWN
            </div>
            <div className="bias-breakdown">
              <div className="bias-card left-lean">
                <h4>{'\u25C0'} Left-Leaning Frame</h4>
                <p>{story.deepDive.leftSpin}</p>
              </div>
              <div className="bias-card right-lean">
                <h4>Right-Leaning Frame {'\u25B6'}</h4>
                <p>{story.deepDive.rightSpin}</p>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDCB0'} WHO BENEFITS?
            </div>
            <p className="analysis-text">{story.deepDive.whosBenefiting}</p>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">
              {'\uD83D\uDD73'} WHAT&apos;S BEING HIDDEN
            </div>
            <p className="analysis-text speculation">{story.deepDive.whatsHidden}</p>
          </div>
        </>
      )}

      <div className="modal-section" style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {story.sourceUrl && (
          <a
            href={story.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dossier-link"
          >
            [READ ORIGINAL {'\u2192'} {story.source}]
          </a>
        )}
        {!published ? (
          <button
            className="dossier-link publish-btn"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? '[PUBLISHING...]' : '[PUBLISH TO SITE]'}
          </button>
        ) : (
          <span className="dossier-link published">[PUBLISHED]</span>
        )}
        <button className="dossier-link" onClick={reset}>
          [ANALYZE ANOTHER]
        </button>
      </div>
    </AnalysisModal>
  );
}
