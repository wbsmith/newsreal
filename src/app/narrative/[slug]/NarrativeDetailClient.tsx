'use client';

import { NarrativeAnalysis } from '@/types';
import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import ShareButton from '@/components/ShareButtons';
import NarrativeAnalysisSections from '@/components/NarrativeAnalysisSections';
import Footer from '@/components/Footer';

interface NarrativeDetailClientProps {
  analysis: NarrativeAnalysis;
}

export default function NarrativeDetailClient({ analysis }: NarrativeDetailClientProps) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const pageUrl = `${siteUrl}/narrative/${analysis.slug}`;
  const plainText = analysis.narrativeText.replace(/<[^>]*>/g, '');

  return (
    <>
      <Header activeFilter="all" onFilterChange={() => {}} />
      <DisclaimerBanner />
      <main className="main-content">
        <div className="story-detail">
          <div className="story-meta">
            <span className="story-source">NARRATIVE DECODE</span>
            <span className="story-time">
              {new Date(analysis.analysisDate).toLocaleString()}
            </span>
          </div>

          <h1 className="story-headline" style={{ fontSize: '30px', marginBottom: '16px' }}>
            <span dangerouslySetInnerHTML={{ __html: analysis.narrativeText }} />
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--accent-cyan)',
              letterSpacing: '1px',
              marginTop: '4px',
            }}
          >
            COHERENCE: {analysis.coherenceScore}% / {analysis.outletsInvolved.length} OUTLETS DETECTED
          </p>

          <ShareButton url={pageUrl} title={plainText} />

          <NarrativeAnalysisSections analysis={analysis} />

          <div className="modal-section" style={{ textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '1.5px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {'\u26A0'} This analysis is AI-generated speculation about narrative patterns.
              Verify all claims independently. Trust no single source &mdash; including us.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
