'use client';

import { useRouter } from 'next/navigation';
import { SearchAnalysis } from '@/types';
import AnalysisModal from './AnalysisModal';
import SearchAnalysisSections from './SearchAnalysisSections';

interface Props {
  analysis: SearchAnalysis;
}

export default function SearchRouteModal({ analysis }: Props) {
  const router = useRouter();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.newsreal.ai';
  const siteUrl = `${origin}/search-analysis/${encodeURIComponent(analysis.query)}`;

  const header = (
    <>
      <div className="story-meta">
        <span className="story-source">SEARCH INTERCEPT</span>
        <span className="story-time">{new Date(analysis.analysisDate).toLocaleString()}</span>
      </div>
      <h2 className="story-headline" style={{ fontSize: '22px' }}>🔍 &quot;{analysis.query}&quot;</h2>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-cyan)', letterSpacing: '1px', marginTop: '4px' }}>
        {analysis.resultCount} RESULTS INTERCEPTED / {analysis.searchResults.length} ANALYZED
      </p>
    </>
  );

  return (
    <AnalysisModal
      open={true}
      onClose={() => router.back()}
      shareUrl={siteUrl}
      shareTitle={`"${analysis.query}" — Suppressed Search`}
      disclaimer="This analysis is AI-generated speculation based on search results. Verify all claims independently. Trust no single source — including us."
      header={header}
    >
      <SearchAnalysisSections analysis={analysis} />
    </AnalysisModal>
  );
}
