# NewsReal.ai — Services & API Keys

## Required Services

| Service | Purpose | Cost Tier | Sign Up |
|---------|---------|-----------|---------|
| **Anthropic API** | Claude Sonnet/Haiku for all analysis | Pay-per-use (~$3/1M input tokens) | https://console.anthropic.com |
| **Supabase** | PostgreSQL database | Free tier → Pro ($25/mo) | https://supabase.com |
| **Upstash** | Redis caching | Free tier → Pro ($10/mo) | https://upstash.com |
| **AWS Amplify** | Hosting + SSR + CI/CD | ~$15-30/mo | https://aws.amazon.com/amplify |
| **Congress.gov API** | Legislative data | Free (API key required) | https://api.congress.gov/sign-up/ |
| **Reddit API** | Social sentiment data | Free tier | https://www.reddit.com/prefs/apps |
| **Federal Register API** | Government filings | Free (no key needed) | https://www.federalregister.gov/developers/ |

## Optional Services

| Service | Purpose | Cost Tier | Sign Up |
|---------|---------|-----------|---------|
| **SerpAPI** | Structured Google News results | $50/mo for 5000 searches | https://serpapi.com |
| **Sentry** | Error monitoring | Free tier | https://sentry.io |
| **Plausible** | Privacy-friendly analytics | $9/mo | https://plausible.io |
| **PostHog** | Product analytics | Free tier | https://posthog.com |

## Estimated Monthly Costs

### Claude API Breakdown

| Usage | Model | Est. Daily Cost | Monthly |
|-------|-------|-----------------|---------|
| ~200 classifications/day | Haiku | $0.50 | $15 |
| ~20 deep dives/day | Sonnet | $1.50 | $45 |
| ~5 enhanced analyses/day | Sonnet | $1.00 | $30 |
| **Total Claude API** | | | **~$90** |

### Infrastructure

| Service | Monthly |
|---------|---------|
| AWS Amplify (SSR hosting) | $15-30 |
| AWS Lambda + EventBridge (cron) | $2-3 |
| AWS CloudWatch (monitoring) | $2-5 |
| Supabase (database) | $0-25 |
| Upstash (Redis) | $0-10 |
| **Total Infrastructure** | **~$20-75** |

### Grand Total

| Scenario | Monthly Cost |
|----------|-------------|
| **Minimal (free tiers)** | ~$110 |
| **Growth (paid tiers)** | ~$200 |
| **Scale (high traffic)** | ~$400+ |
