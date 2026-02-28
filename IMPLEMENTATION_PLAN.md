# NewsReal.ai — Implementation Plan

## 1. Project Vision

**NewsReal.ai** is a media criticism and entertainment platform that surfaces "the story behind the story." It exposes biases driving news coverage on all sides, speculates on the real forces behind headlines, and highlights what's being obscured by the current news cycle. The tone is conspiracy-adjacent — provocative, attention-grabbing, and deeply skeptical of all institutions — but self-aware: every piece of AI-generated analysis is clearly labeled as speculation.

This is not a parody site. It's not satire. It's a lens. The premise is simple: all news is narrative construction, and NewsReal.ai exists to deconstruct those narratives in real time — with maximal transparency about the fact that our own analysis is AI-generated and speculative.

### Core Principles

- **Distrust all narratives equally.** Left, right, establishment, anti-establishment — every frame is a frame. We expose all of them.
- **Follow the money, always.** The most useful question for any story is: who benefits?
- **Highlight what's NOT being covered.** The Obfuscation Index — stories buried by the news cycle — is the most important feature on the site.
- **Full transparency about our own nature.** Every AI-generated analysis carries a clear label. The site-wide disclaimer is persistent and prominent. We are not pretending to be journalists.
- **Attention-grabbing over accurate.** Our speculation doesn't need to be right — it needs to make people think. We are explicit about this.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                     │
│         Dark conspiracy-noir UI (see prototype)           │
│         SSR + ISR for SEO + performance                   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   API LAYER (Next.js API Routes)          │
│                                                           │
│  /api/stories     — aggregated + analyzed stories         │
│  /api/ticker      — real-time narrative alerts            │
│  /api/narratives  — dominant narrative tracking           │
│  /api/obfuscation — buried story detection                │
│  /api/deep-dive   — full AI analysis for a story          │
│  /api/cron/ingest — scheduled news ingestion              │
└──────┬──────────┬──────────┬───────────┬────────────────┘
       │          │          │           │
┌──────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌────▼─────┐
│ News APIs │ │ Social │ │ Fed    │ │ Anthropic│
│ AP/RSS/   │ │ Scrape │ │Register│ │ Claude   │
│ Reuters/  │ │ Reddit │ │ .gov   │ │ API      │
│ Google    │ │ X/Blue │ │ PACER  │ │ (Sonnet) │
│ News      │ │ sky    │ │ SEC    │ │          │
└──────────┘ └────────┘ └────────┘ └──────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   DATA LAYER                              │
│                                                           │
│  PostgreSQL (Supabase/Neon)   — stories, analyses, meta   │
│  Redis (Upstash)              — caching, rate limiting     │
│  Vector DB (Pinecone/pgvector)— narrative clustering       │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14+ (App Router) | SSR for SEO, API routes, ISR for caching |
| Styling | Tailwind CSS + custom CSS variables | Matches the dark conspiracy-noir aesthetic |
| Database | PostgreSQL via Supabase or Neon | Stories, analysis cache, user data |
| Cache | Redis via Upstash | API response caching, rate limiting |
| AI Engine | Anthropic Claude API (Sonnet) | All analysis generation |
| News Ingestion | Node.js cron workers | Scheduled pulls from news APIs |
| Deployment | AWS Amplify | Managed Next.js hosting with SSR support, integrated CI/CD |
| Domain | newsreal.ai | Already owned |

---

## 3. News Ingestion Pipeline

### 3.1 Data Sources

#### Tier 1: Wire Services & Aggregators (Primary Headlines)

| Source | Method | Rate | Notes |
|--------|--------|------|-------|
| **AP News** | RSS feeds (https://rsshub.app/apnews/topics/*) | Every 15 min | Most neutral wire service |
| **Reuters** | RSS feeds (https://www.reutersagency.com/feed/) | Every 15 min | Global coverage |
| **Google News** | RSS (https://news.google.com/rss) + SerpAPI for structured | Every 15 min | Aggregated trending |
| **Yahoo News** | RSS feeds | Every 30 min | Mainstream aggregation |
| **NPR** | RSS API | Every 30 min | Left-establishment baseline |
| **Fox News** | RSS feeds | Every 30 min | Right-establishment baseline |

#### Tier 2: Government & Regulatory (Obfuscation Index)

| Source | Method | Rate | Notes |
|--------|--------|------|-------|
| **Federal Register** | API (https://www.federalregister.gov/developers/) | Daily | Buried regulations — this is gold |
| **Congress.gov** | API (https://api.congress.gov/) | Daily | Bills, votes, amendments |
| **SEC EDGAR** | EDGAR Full-Text Search API | Daily | Corporate filings |
| **PACER** | RSS feeds for notable courts | Daily | Federal court filings |
| **WhiteHouse.gov** | RSS/scrape | Daily | Executive orders, statements |
| **USAspending.gov** | API | Weekly | Federal contract awards |

#### Tier 3: Social Sentiment (Narrative Detection)

| Source | Method | Rate | Notes |
|--------|--------|------|-------|
| **Reddit** | Reddit API (free tier) or old.reddit RSS | Every 30 min | r/news, r/politics, r/conspiracy, r/worldnews |
| **X/Twitter** | Scraping via Nitter instances or paid API | Every 30 min | Trending topics, reply sentiment |
| **Bluesky** | AT Protocol API (free) | Every 30 min | Growing alternative narrative source |
| **YouTube** | YouTube Data API v3 | Hourly | Trending news commentary |
| **Google Trends** | Unofficial API (pytrends port) | Hourly | What people are actually searching |

### 3.2 Ingestion Worker Architecture

```
┌──────────────────────────────────────────┐
│           CRON SCHEDULER                  │
│  (AWS EventBridge Scheduler → Lambda)     │
│                                           │
│  Every 15 min → /api/cron/ingest-news     │
│  Every 30 min → /api/cron/ingest-social   │
│  Every 24 hrs → /api/cron/ingest-gov      │
│  Every 1 hr  → /api/cron/analyze          │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│         INGESTION PIPELINE                │
│                                           │
│  1. Fetch from sources (RSS parse, API)   │
│  2. Deduplicate (fuzzy title matching)    │
│  3. Categorize (politics/tech/finance/..) │
│  4. Store raw in PostgreSQL               │
│  5. Queue for AI analysis                 │
│  6. Cross-reference with gov/regulatory   │
│  7. Generate AI deep-dive                 │
│  8. Cache final output in Redis           │
└──────────────────────────────────────────┘
```

### 3.3 Story Deduplication & Clustering

Multiple sources will cover the same event. Use:

1. **Fuzzy title matching** (Levenshtein distance or `fuzzball` library) — threshold 0.75 similarity
2. **Entity extraction** — identify shared people, organizations, events
3. **Temporal clustering** — group stories published within 2-hour windows about similar entities
4. **Narrative clustering** — use embeddings (Claude or OpenAI) + cosine similarity to group stories into narrative threads

Each cluster becomes a single "story" on NewsReal with multiple source perspectives tracked.

---

## 4. AI Analysis Engine

This is the core of NewsReal.ai. Every story gets processed through Claude to generate the analysis layers.

### 4.1 Analysis Pipeline

For each story cluster, generate:

| Layer | Description | Display Location |
|-------|-------------|-----------------|
| **Manipulation Index** | 0-100 score of how "manufactured" the narrative feels | Story card + modal |
| **Bias Tag** | Classification: Lean Left, Lean Right, Establishment, Anti-Establishment, Unreported | Story card |
| **Quick Take** | 2-3 sentence "real analysis" for the card view | Story card |
| **Mainstream Frame** | How establishment media is framing this | Modal |
| **The Real Story** | Speculative analysis of actual drivers | Modal |
| **Left Spin** | How left-leaning outlets frame + what they omit | Modal |
| **Right Spin** | How right-leaning outlets frame + what they omit | Modal |
| **Who Benefits** | Follow-the-money analysis | Modal |
| **What's Hidden** | What's being obscured or not covered | Modal |
| **Obfuscation Link** | Connection to buried gov/regulatory actions | Modal |

### 4.2 Cost Management Strategy

The biggest variable cost is Claude API calls. Strategies:

1. **Cache aggressively** — analysis for a story cluster only needs to run once. Cache in Redis for 6 hours, then in PostgreSQL permanently.
2. **Batch analysis** — don't analyze stories one-by-one. Batch 5-10 related stories into a single Claude call.
3. **Use Haiku for classification** — bias tags and manipulation scores can use the cheaper Haiku model. Reserve Sonnet for deep-dive analysis.
4. **Tiered analysis depth:**
   - All stories get: bias tag + manipulation index + quick take (Haiku — cheap)
   - Top 20 stories/day get: full deep dive (Sonnet — moderate)
   - Top 5 stories get: enhanced cross-reference analysis (Sonnet — full)
5. **User-triggered deep dives** — generate the full modal analysis on-demand when a user clicks, not preemptively for all stories.

**Estimated usage:**
- ~200 stories/day ingested
- ~200 Haiku calls/day (classification): ~$0.50/day
- ~20 Sonnet calls/day (deep dives): ~$1.50/day
- ~5 enhanced analyses/day: ~$1.00/day
- **Total: ~$90/month in API costs**

---

## 5. Frontend Specification

### 5.1 Design System

The prototype HTML file (`newsreal-prototype.html`) is the definitive reference for the visual design. Key specs:

**Color Palette:**
- `--bg-deep: #0a0a0c` (page background)
- `--bg-card: #111116` (card surfaces)
- `--accent-red: #c62828` / `--accent-red-glow: #ff1744` (danger, manipulation)
- `--accent-gold: #d4a017` (AI speculation, warnings)
- `--accent-cyan: #00bcd4` (sources, data)
- `--accent-green: #4caf50` (low manipulation)
- `--accent-purple: #7c4dff` (establishment tag)

**Typography:**
- Display: Playfair Display (headlines)
- Mono: JetBrains Mono (metadata, labels, AI text)
- Body: Source Serif 4 (summaries, body text)

**Effects:**
- Scanline overlay (CSS repeating-linear-gradient)
- Noise texture (SVG filter)
- Glitch text animation (on loading)
- Pulse animation (live indicator)
- Redacted text (click to reveal)

### 5.2 Page Structure

**Homepage (`/`)**
- Sticky header with logo, dateline, live indicator, category nav
- Persistent disclaimer banner
- Ticker bar (auto-scrolling alerts)
- Content layout: stories grid (left) + sidebar panels (right)
- Story cards with manipulation meters, bias tags, quick-take analysis
- Featured story card spans full width with analysis visible

**Story Detail (`/story/[slug]`)**
- Could be modal (as in prototype) or full page
- Full analysis breakdown: mainstream frame, real story, bias breakdown (left/right cards), who benefits, what's hidden
- Related government filings
- Social sentiment snapshot
- "What else happened today" cross-reference

**Category Pages (`/category/[slug]`)**
- Filtered story grid
- Category-specific narrative tracker

**Obfuscation Index (`/obfuscation`)**
- Dedicated page for buried stories
- Federal Register integration
- "Days since coverage" counter
- Cross-reference with news cycle

### 5.3 Project Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── story/[slug]/page.tsx
│   ├── category/[slug]/page.tsx
│   ├── obfuscation/page.tsx
│   └── api/
│       ├── stories/route.ts
│       ├── ticker/route.ts
│       ├── narratives/route.ts
│       ├── obfuscation/route.ts
│       ├── deep-dive/[id]/route.ts
│       └── cron/
│           ├── ingest-news/route.ts
│           ├── ingest-social/route.ts
│           ├── ingest-gov/route.ts
│           └── analyze/route.ts
├── components/
│   ├── Header.tsx
│   ├── DisclaimerBanner.tsx
│   ├── Ticker.tsx
│   ├── StoryCard.tsx
│   ├── StoryGrid.tsx
│   ├── StoryModal.tsx
│   ├── ManipulationMeter.tsx
│   ├── BiasTag.tsx
│   ├── RedactedText.tsx
│   ├── NarrativeTracker.tsx
│   ├── ObfuscationIndex.tsx
│   ├── SuppressedSearches.tsx
│   ├── BiasBreakdown.tsx
│   └── CategoryNav.tsx
├── lib/
│   ├── db.ts
│   ├── cache.ts
│   ├── claude.ts
│   ├── ingestion/
│   │   ├── ap-news.ts
│   │   ├── reuters.ts
│   │   ├── google-news.ts
│   │   ├── reddit.ts
│   │   ├── federal-register.ts
│   │   ├── congress.ts
│   │   └── dedup.ts
│   ├── analysis/
│   │   ├── story-analyzer.ts
│   │   ├── obfuscation-detector.ts
│   │   ├── narrative-tracker.ts
│   │   └── prompts.ts
│   └── utils/
│       ├── clustering.ts
│       └── scoring.ts
└── styles/
    └── globals.css
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Next.js project setup with TypeScript
- [ ] Database schema creation (Supabase)
- [ ] Core UI components from prototype
- [ ] Basic RSS ingestion (AP, Reuters, Google News)
- [ ] Story deduplication
- [ ] Static rendering of homepage with mock data
- [ ] Deploy to AWS Amplify with newsreal.ai domain

### Phase 2: AI Analysis Engine (Week 3-4)
- [ ] Claude API integration
- [ ] Story analysis pipeline (all layers)
- [ ] Manipulation Index scoring
- [ ] Bias tag classification
- [ ] Story modal with full deep-dive
- [ ] Redis caching for analysis results
- [ ] Rate limiting and cost management

### Phase 3: Government Cross-Reference (Week 5-6)
- [ ] Federal Register API integration
- [ ] Congress.gov API integration
- [ ] SEC EDGAR integration
- [ ] Obfuscation Index detection
- [ ] "What else happened today" cross-referencing
- [ ] Dedicated obfuscation page

### Phase 4: Social & Narrative (Week 7-8)
- [ ] Reddit API integration
- [ ] Bluesky AT Protocol integration
- [ ] X/Twitter data (scraping or API)
- [ ] Narrative coherence detection
- [ ] Sentiment analysis
- [ ] Bot ratio estimation
- [ ] Ticker bar with real alerts

### Phase 5: Polish & Scale (Week 9-10)
- [ ] SEO optimization (meta tags, OG images, structured data)
- [ ] Performance optimization (ISR, edge caching)
- [ ] Email newsletter digest
- [ ] RSS feed output
- [ ] Analytics (Plausible or PostHog)
- [ ] Error monitoring (Sentry)
- [ ] Load testing

---

## 7. Legal Considerations

### Content Disclaimers (REQUIRED on every page)

1. **Site-wide banner** (persistent, non-dismissible):
   > "All analysis on NewsReal.ai is generated by artificial intelligence for entertainment and media criticism purposes. Nothing on this site constitutes journalism, factual reporting, or verified information. All speculation is clearly labeled. Question everything — including us."

2. **Per-analysis label** on every AI-generated block:
   > "◈ AI SPECULATION — This analysis was generated by AI and has not been fact-checked."

3. **Terms of Service** must include:
   - The site uses AI to generate speculative commentary
   - No content should be treated as factual reporting
   - The site is for entertainment and media literacy purposes
   - Users are responsible for verifying any claims independently

### Fair Use Position
- We aggregate headlines and metadata, not full article text
- Our analysis is transformative commentary and criticism
- We link back to original sources
- We do not reproduce copyrighted content in full

### API Terms Compliance
- Respect rate limits on all news APIs
- Attribute sources properly
- Don't cache full article text (only headlines + summaries)
- Comply with RSS feed terms of use
