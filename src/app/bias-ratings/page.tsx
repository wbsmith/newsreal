'use client';

import Header from '@/components/Header';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import Footer from '@/components/Footer';

export default function BiasRatingsPage() {
  return (
    <>
      <Header activeFilter="all" onFilterChange={() => {}} />
      <DisclaimerBanner />
      <main className="main-content">
        <div className="story-detail">
          <h1 className="static-page-title">Bias Rating System</h1>

          <p>
            Every story on NewsReal.ai gets a bias tag and a manipulation score.
            Here&rsquo;s what they mean and how they&rsquo;re generated.
          </p>

          <h2>Bias Tags</h2>
          <p>
            Each story is tagged with a bias label reflecting the dominant framing of
            the source&rsquo;s coverage — not the story&rsquo;s topic, but how the outlet
            chose to present it. Tags include:
          </p>
          <ul>
            <li><strong>Left-Leaning</strong> — framing favors progressive narratives or Democratic positions</li>
            <li><strong>Right-Leaning</strong> — framing favors conservative narratives or Republican positions</li>
            <li><strong>Establishment</strong> — framing supports institutional authority and status-quo positions</li>
            <li><strong>Anti-Establishment</strong> — framing challenges institutional narratives regardless of left/right</li>
            <li><strong>Corporate</strong> — framing protects or advances specific corporate interests</li>
            <li><strong>Sensationalist</strong> — framing prioritizes emotional engagement over substance</li>
          </ul>

          <h2>Manipulation Score</h2>
          <p>
            The manipulation score (0–100) measures how aggressively a headline or story
            employs known persuasion techniques. Higher scores indicate more manipulation,
            not necessarily more bias. A story can be biased with a low manipulation score
            (straightforward advocacy) or highly manipulative with no clear political lean
            (pure clickbait).
          </p>
          <p>Factors that increase the score:</p>
          <ul>
            <li>Emotional language designed to provoke rather than inform</li>
            <li>Missing context that changes the story&rsquo;s meaning</li>
            <li>False equivalence or false dichotomy framing</li>
            <li>Buried lede — the most important information hidden or omitted</li>
            <li>Appeal to authority without substantiation</li>
            <li>Headline/body mismatch — when the article doesn&rsquo;t support the headline</li>
          </ul>

          <h2>Important Caveats</h2>
          <p>
            These ratings are AI-generated assessments, not editorial judgments. The model
            evaluates framing techniques and language patterns — it does not determine
            truth or falsity. A story rated &ldquo;low manipulation&rdquo; can still be
            wrong, and a &ldquo;high manipulation&rdquo; story can still contain accurate
            information. Use these scores as one signal among many.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
