'use client';

import { useEffect, useCallback, ReactNode } from 'react';
import ShareButton from './ShareButtons';

interface AnalysisModalProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  loadingText?: string;
  loadingSubtext?: string;
  error?: string | null;
  shareUrl?: string;
  shareTitle?: string;
  disclaimer?: string;
  header?: ReactNode;
  children?: ReactNode;
}

export default function AnalysisModal({
  open,
  onClose,
  loading,
  loadingText,
  loadingSubtext,
  error,
  shareUrl,
  shareTitle,
  disclaimer = 'This analysis is AI-generated speculation. Verify all claims independently. Trust no single source \u2014 including us.',
  header,
  children,
}: AnalysisModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          {'\u00D7'}
        </button>

        {loading && (
          <div className="search-loading">
            <div className="loading-text" style={{ fontSize: '14px', marginBottom: '16px' }}>
              {loadingText || 'ANALYZING...'}
            </div>
            <div className="loading-bar">
              <div className="loading-fill" />
            </div>
            {loadingSubtext && (
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '16px',
                  letterSpacing: '1px',
                }}
              >
                {loadingSubtext}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="modal-section">
            <div className="modal-section-title">{'\u26A0'} ANALYSIS FAILED</div>
            <p className="analysis-text" style={{ color: 'var(--accent-red)' }}>
              {error}
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            {header}

            {shareUrl && shareTitle && (
              <ShareButton url={shareUrl} title={shareTitle} />
            )}

            {children}

            <div className="modal-section" style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginTop: '16px',
                }}
              >
                {'\u26A0'} {disclaimer}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
