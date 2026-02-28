import { Story, Narrative, Obfuscation, TickerItem } from '@/types';

export const MOCK_STORIES: Story[] = [
  {
    id: 1,
    slug: 'congress-ai-regulation-bill',
    category: 'politics',
    featured: true,
    source: 'AP NEWS',
    sourceUrl: 'https://apnews.com',
    time: '2 hours ago',
    headline: 'Congress Passes Sweeping AI Regulation Bill After Months of Debate',
    summary: 'The legislation, which passed with bipartisan support, establishes new oversight mechanisms for AI companies with significant penalties for non-compliance. Tech industry groups have issued mixed reactions.',
    biasTag: { label: 'ESTABLISHMENT', class: 'establishment' },
    manipulationScore: 78,
    realAnalysis: 'Notice the timing: this bill surfaces right as three major defense contractors finalized AI procurement deals worth $14B collectively. The "oversight" framework was drafted by lobbyists from the very companies it claims to regulate. The bipartisan nature isn\'t unity — it\'s both sides protecting [REDACTED:the same donor class].',
    deepDive: {
      mainstream: 'Framed as responsible governance and a win for consumer protection. Coverage emphasizes bipartisan cooperation and positions the US as a leader in AI safety.',
      realStory: 'The bill\'s compliance framework requires infrastructure only Fortune 500 companies can afford, effectively creating a regulatory moat against startups. Three senators who led the bill received combined $2.3M from tech PACs in the last cycle. The "penalties" have carve-outs large enough to drive a datacenter through.',
      leftSpin: 'Progressive outlets celebrate it as reining in Big Tech, while conveniently ignoring that the bill pre-empts stronger state regulations in California and New York that actually had teeth.',
      rightSpin: 'Conservative media frames it as government overreach and anti-innovation, but won\'t mention that Republican co-sponsors secured exemptions for defense and surveillance applications.',
      whosBenefiting: 'Incumbent AI labs (regulatory capture), defense sector (exemptions), consulting firms (compliance industry), and politicians (campaign contributions + good optics).',
      whatsHidden: 'Section 47(b) of the bill quietly authorizes a new data-sharing agreement between AI companies and intelligence agencies for "national security purposes" with minimal oversight. Nobody in media is talking about this provision.'
    }
  },
  {
    id: 2,
    slug: 'fed-rate-cut-signal',
    category: 'finance',
    source: 'REUTERS',
    sourceUrl: 'https://reuters.com',
    time: '4 hours ago',
    headline: 'Federal Reserve Signals Potential Rate Cut Amid Mixed Economic Data',
    summary: 'Fed officials suggested openness to monetary policy easing in upcoming meetings, while emphasizing data dependency. Markets rallied on the news.',
    biasTag: { label: 'CENTER-ESTABLISHMENT', class: 'center' },
    manipulationScore: 65,
    realAnalysis: 'Every "signal" is pre-negotiated. The Fed leaked to three specific journalists simultaneously — a controlled information release designed to move markets in a specific window. Ask yourself: who was positioned [REDACTED:in options markets] before the "news" broke?',
    deepDive: {
      mainstream: 'Standard coverage focuses on inflation metrics and employment data. Positions it as data-driven technocratic decision-making.',
      realStory: 'The rate cut signal coincides with $890B in corporate debt that needs refinancing in Q3. The Fed isn\'t responding to "the economy" — it\'s preventing a corporate debt crisis that would expose how fragile the post-2020 recovery actually is.',
      leftSpin: 'Framed as potential relief for homebuyers and working families, obscuring that cheap money primarily inflates asset prices held by the top 10%.',
      rightSpin: 'Framed as admission of economic weakness under current administration, without acknowledging that rate policy operates on multi-year lag from prior administration decisions.',
      whosBenefiting: 'Banks holding distressed commercial real estate, corporations needing to refinance, and political incumbents who need a market rally before election cycles.',
      whatsHidden: 'The real concern is the $1.2T in commercial real estate loans coming due, with office vacancy rates at historic highs. A rate cut is a bailout of commercial real estate disguised as stimulus.'
    }
  },
  {
    id: 3,
    slug: 'social-platform-content-moderation',
    category: 'tech',
    source: 'GOOGLE NEWS',
    sourceUrl: 'https://news.google.com',
    time: '6 hours ago',
    headline: 'Major Social Platform Announces Overhaul of Content Moderation Policies',
    summary: 'The company will shift to a "community-based" moderation model, reducing centralized review teams and introducing user-driven content councils.',
    biasTag: { label: 'LEAN RIGHT', class: 'right' },
    manipulationScore: 82,
    realAnalysis: 'Translation: they\'re cutting costs by 40% on trust & safety while rebranding it as "empowerment." The timing aligns with a [REDACTED:major advertiser exodus] that demanded cheaper operations. "Community moderation" = plausible deniability.',
    deepDive: {
      mainstream: 'Tech press covers it as innovation in platform governance. Some frame it as a free speech win, others as abandoning safety.',
      realStory: 'Internal documents show this decision was driven by a 34% decline in ad revenue. The "community councils" have no enforcement power and serve primarily as PR cover. Meanwhile, the algorithmic recommendation engine — the actual driver of harmful content — remains untouched.',
      leftSpin: 'Framed as dangerous deregulation that will flood platforms with misinformation and hate speech, amplifying fears that serve to justify calls for government regulation (which these same outlets also benefit from covering).',
      rightSpin: 'Celebrated as a victory over "censorship" and "woke moderation," while ignoring that the algorithmic amplification system that decides what you see remains entirely opaque and unchanged.',
      whosBenefiting: 'The platform (cost savings), political operatives (looser enforcement), engagement-bait creators (more reach), and media outlets on both sides (outrage content).',
      whatsHidden: 'The company simultaneously filed 12 patents for AI-driven "behavioral prediction" targeting. They\'re not moderating less — they\'re shifting from content control to behavioral manipulation, which is far more valuable and far less visible.'
    }
  },
  {
    id: 4,
    slug: 'g7-southeast-asia-infrastructure',
    category: 'world',
    source: 'AP NEWS',
    sourceUrl: 'https://apnews.com',
    time: '8 hours ago',
    headline: 'G7 Nations Announce Joint Infrastructure Investment in Southeast Asia',
    summary: 'Leaders pledged $40 billion in combined infrastructure spending across the region, framing it as an alternative to existing development programs.',
    biasTag: { label: 'LEAN LEFT', class: 'left' },
    manipulationScore: 71,
    realAnalysis: 'This isn\'t charity — it\'s a resource grab wrapped in development language. Every "infrastructure" project maps directly to a [REDACTED:critical mineral supply chain] that Western nations are racing to secure before 2030.',
    deepDive: {
      mainstream: 'Covered as diplomatic cooperation and development partnership. Emphasis on democratic values and sustainable development.',
      realStory: 'The $40B is actually $8B in grants and $32B in loans with conditions requiring procurement from G7-based companies. The projects target regions with lithium, cobalt, and rare earth deposits essential for AI hardware and EV batteries.',
      leftSpin: 'Praised as progressive multilateral engagement and climate-conscious development, without examining the neo-colonial dynamics of conditional loans tied to Western corporate interests.',
      rightSpin: 'Either ignored or criticized as wasteful foreign spending, missing the strategic resource competition angle that actually serves national security interests conservatives claim to prioritize.',
      whosBenefiting: 'G7 mining companies, infrastructure contractors, semiconductor supply chains, and politicians who can claim both "development" and "competition" wins.',
      whatsHidden: 'Three of the target nations recently discovered significant rare earth deposits. The "infrastructure" includes deep-water ports that just happen to serve dual military-logistics purposes. This is a mineral colonization play disguised as aid.'
    }
  },
  {
    id: 5,
    slug: 'pharma-alzheimers-breakthrough',
    category: 'science',
    source: 'REUTERS',
    sourceUrl: 'https://reuters.com',
    time: '10 hours ago',
    headline: "Pharmaceutical Giant Reports Breakthrough in Alzheimer's Treatment Trial",
    summary: "Phase 3 trials showed a 35% reduction in cognitive decline markers. The company's stock surged 12% on the announcement. FDA fast-track designation expected.",
    biasTag: { label: 'ESTABLISHMENT', class: 'establishment' },
    manipulationScore: 74,
    realAnalysis: 'The 35% figure is relative reduction, not absolute. Absolute improvement is closer to 4-6 months of delayed decline over 18 months. The stock surge happened [REDACTED:before the announcement] if you look at the pre-market trading patterns.',
    deepDive: {
      mainstream: "Breakthrough language dominates coverage. Human interest stories of Alzheimer's patients lead the segments. Stock performance treated as validation.",
      realStory: "The trial design excluded the most common comorbidities in Alzheimer's patients, limiting real-world applicability. The drug costs an estimated $28,000/year. The \"breakthrough\" framing serves a patent cliff — the company's top revenue drug goes generic in 18 months.",
      leftSpin: "Focuses on drug pricing and accessibility concerns, while still amplifying the breakthrough narrative that serves the company's market cap.",
      rightSpin: 'Champions American pharmaceutical innovation and deregulation, avoiding discussion of the $4.2B in NIH-funded basic research that made the drug possible.',
      whosBenefiting: 'The pharma company (stock price, pipeline valuation), institutional investors (positioned before announcement), FDA officials (revolving door incentive to fast-track), and politicians (photo ops with patients).',
      whatsHidden: "Two competing treatments from smaller companies with arguably better efficacy data have been stuck in regulatory limbo for 3 years. The fast-track designation for this drug may be related to the company's lobbying spend, which tripled last year."
    }
  },
  {
    id: 6,
    slug: 'treasury-foreign-transaction-reporting',
    category: 'deep-state',
    source: 'CROSS-REF',
    sourceUrl: '#',
    time: '12 hours ago',
    headline: 'Quiet Policy Shift: Treasury Department Revises Foreign Transaction Reporting Thresholds',
    summary: 'A regulatory update buried in the Federal Register adjusts reporting requirements for international financial transactions. No major media coverage detected.',
    biasTag: { label: 'UNREPORTED', class: 'establishment' },
    manipulationScore: 91,
    realAnalysis: 'This is the story. While every camera pointed at the AI bill, Treasury quietly lowered surveillance thresholds on personal international transactions to $600 — down from $10,000. This affects every American with family abroad, freelancers with international clients, and [REDACTED:cryptocurrency off-ramps]. Zero coverage. Zero debate.',
    deepDive: {
      mainstream: 'THERE IS NO MAINSTREAM COVERAGE. That is the point.',
      realStory: 'This regulatory change was filed the same day as the AI bill vote, ensuring zero media bandwidth. The $600 threshold matches IRS 1099-K reporting changes, creating a unified financial surveillance framework. Combined with existing bank reporting requirements, the government now has visibility into virtually all electronic financial activity.',
      leftSpin: 'Would frame as necessary to combat tax evasion by the wealthy — if they covered it at all.',
      rightSpin: 'Would frame as government overreach and surveillance state — if they covered it at all.',
      whosBenefiting: 'Treasury enforcement (expanded powers without legislation), financial surveillance contractors (new data processing contracts), and politicians (revenue projections without a vote).',
      whatsHidden: 'This is step 3 of a 5-step framework outlined in a 2023 Treasury white paper on "Transaction Transparency." Steps 4 and 5 involve real-time reporting and AI-powered pattern detection. The infrastructure for a comprehensive financial surveillance system is being built incrementally, below the threshold of public attention.'
    }
  }
];

export const NARRATIVES: Narrative[] = [
  { text: '<strong>"AI regulation"</strong> as proxy for market consolidation', heat: '\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2591\u2591 82%' },
  { text: '<strong>"Rate cuts"</strong> as corporate bailout packaging', heat: '\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2591\u2591\u2591 71%' },
  { text: '<strong>"Content moderation"</strong> as cost-cutting rebrand', heat: '\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2591 88%' },
  { text: '<strong>"Infrastructure investment"</strong> as resource colonization', heat: '\u2593\u2593\u2593\u2593\u2593\u2593\u2591\u2591\u2591\u2591 64%' },
  { text: '<strong>"Medical breakthrough"</strong> as stock catalyst', heat: '\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2591\u2591\u2591 74%' },
];

export const OBFUSCATIONS: Obfuscation[] = [
  {
    category: 'TREASURY REPORTING THRESHOLD',
    whatHappened: 'Financial surveillance expansion buried under AI bill news cycle.',
    whyItMatters: 'Financial surveillance expansion buried under AI bill news cycle. No congressional vote required.',
    whatsCoveringIt: 'AI regulation bill media frenzy',
    whoBenefits: 'Treasury enforcement, financial surveillance contractors',
    detectionConfidence: 94,
  },
  {
    category: 'DOD CLOUD CONTRACT AWARDS',
    whatHappened: 'Three no-bid contracts totaling $8.2B awarded.',
    whyItMatters: 'Three no-bid contracts totaling $8.2B awarded same week as "bipartisan AI safety" coverage dominated.',
    whatsCoveringIt: 'AI safety bill coverage',
    whoBenefits: 'Defense contractors, cloud infrastructure providers',
    detectionConfidence: 87,
  },
  {
    category: 'EPA ENFORCEMENT ROLLBACK',
    whatHappened: 'Quiet rule change reducing industrial emissions monitoring frequency.',
    whyItMatters: 'Quiet rule change reducing industrial emissions monitoring frequency filed in Federal Register page 847.',
    whatsCoveringIt: 'Congressional AI debate',
    whoBenefits: 'Industrial polluters, fossil fuel companies',
    detectionConfidence: 79,
  },
];

export const SUPPRESSED_SEARCHES: string[] = [
  '"Section 47(b)" AI bill intelligence sharing',
  'commercial real estate loan maturity 2025 2026',
  'behavioral prediction patent filings social media',
  'rare earth mining Southeast Asia G7 contracts',
  'Treasury transaction reporting threshold change',
  'pharmaceutical trial exclusion criteria Alzheimer',
  'pre-market trading patterns biotech announcement',
];

export const TICKER_ITEMS: TickerItem[] = [
  { text: 'NARRATIVE COHERENCE INDEX: 73% \u2014 coordinated messaging detected across 4 outlets', severity: 'high' },
  { text: 'OBFUSCATION ALERT: 3 Federal Register filings with zero media coverage', severity: 'high' },
  { text: 'BIAS DRIFT: Reuters coverage shifted 12% establishment-ward this quarter', severity: 'med' },
  { text: 'SOCIAL SIGNAL: "Rate cut" sentiment manufactured \u2014 bot ratio 34%', severity: 'high' },
  { text: 'PATTERN: 6 "breakthrough" announcements timed to earnings cycles', severity: 'med' },
  { text: 'SUPPRESSION: Search autocomplete modified for 3 policy-related queries', severity: 'high' },
  { text: 'FUNDING TRAIL: AI bill co-sponsors received $18.7M from regulated entities', severity: 'high' },
  { text: 'DISTRACTION INDEX: Entertainment news volume +340% during policy votes', severity: 'med' },
];

export const LOADING_MESSAGES = [
  'Scanning AP, Reuters, and wire services...',
  'Cross-referencing narrative patterns...',
  'Analyzing media ownership connections...',
  'Detecting coordinated messaging...',
  'Mapping funding trails...',
  'Decoding editorial slant vectors...',
  'Intercepting suppressed storylines...',
  'Calibrating manipulation indices...',
  'Rendering the uncomfortable truth...',
];
