'use client';

import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import Footer from '@/components/Footer';

export default function ContactPage() {
  return (
    <>
      <Header activeFilter="all" onFilterChange={() => {}} />
      <DisclaimerBanner />
      <main className="main-content">
        <div className="story-detail">
          <h1 className="static-page-title">Contact</h1>

          <p>
            NewsReal.ai is a small, independent project. We read everything that comes in,
            but response times vary.
          </p>

          <h2>General Inquiries</h2>
          <p>
            For questions, feedback, or to report an issue with our analysis:
            <br />
            <a href="mailto:contact@newsreal.ai" style={{ color: 'var(--accent-cyan)' }}>
              contact@newsreal.ai
            </a>
          </p>

          <h2>Source Suggestions</h2>
          <p>
            Think we&rsquo;re missing a news source that should be in our pipeline?
            Send us the outlet name and RSS feed URL. We evaluate sources based on
            reach, editorial distinctiveness, and whether they fill a gap in our
            current spectrum coverage.
          </p>

          <h2>Bug Reports</h2>
          <p>
            If something on the site is broken — a story page that won&rsquo;t load,
            an analysis that renders incorrectly, a vote that doesn&rsquo;t register —
            include the URL and a screenshot if you can.
          </p>

          <h2>What We Won&rsquo;t Respond To</h2>
          <p>
            Requests to remove stories, adjust bias ratings for specific outlets, or
            soften analysis of particular institutions. The whole point is that nobody
            gets special treatment.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
