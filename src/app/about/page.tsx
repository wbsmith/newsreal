'use client';

import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <>
      <Header activeFilter="all" onFilterChange={() => {}} />
      <DisclaimerBanner />
      <main className="main-content">
        <div className="story-detail">
          <h1 className="static-page-title">About NewsReal.ai</h1>

          <p>
            NewsReal.ai is an AI-powered media criticism and entertainment platform. We use
            artificial intelligence to generate provocative, speculative analysis of news
            stories — exposing biases on all sides, following the money, and highlighting
            what&rsquo;s being buried by the news cycle.
          </p>

          <h2>What We Are</h2>
          <p>
            We are a lens for deconstructing media narratives. Every story that passes through
            our system gets analyzed for bias framing, manipulation techniques, financial
            connections, and coordinated messaging patterns. We name names, cite dollar amounts,
            and draw connections that mainstream coverage tends to leave out.
          </p>

          <h2>What We Are Not</h2>
          <p>
            We are not a news source. We do not do original reporting. We do not claim our
            AI-generated analysis is factual — it is clearly labeled speculation designed to
            make you think harder about the stories you consume. If you treat our output as
            gospel, you&rsquo;ve missed the point entirely.
          </p>

          <h2>Why We Exist</h2>
          <p>
            Every news outlet has an angle. Every editorial board has a donor list. Every
            &ldquo;objective&rdquo; framing serves someone&rsquo;s interests. We exist because
            media literacy requires asking uncomfortable questions about every source —
            including the ones you agree with.
          </p>
          <p>
            No sacred cows. No protected institutions. No side gets a pass.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
