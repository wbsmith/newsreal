# NewsReal.ai — AWS Amplify Deployment Guide

## Why AWS Amplify

- Full AWS ecosystem access (EventBridge, Lambda, SQS, CloudWatch)
- Better control over SSR compute (no cold start limits)
- Native integration with other AWS services if needed later (SES for newsletters, Comprehend for NLP, etc.)
- Cost predictability at scale

---

## Amplify Build Configuration

Create `amplify.yml` in the project root:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

---

## Next.js Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Amplify SSR
  images: {
    unoptimized: false, // Amplify supports Next.js image optimization
  },
}
module.exports = nextConfig
```

---

## Cron Jobs Strategy

Amplify doesn't have built-in cron like some other platforms. Two options:

### Option A: AWS EventBridge + Lambda (Recommended)

Create lightweight Lambda functions that call your Next.js API routes. EventBridge schedules them. This is more robust and survives deploys.

**Schedule rules:**
| Rule | Schedule | Target |
|------|----------|--------|
| ingest-news | `rate(15 minutes)` | Lambda → `POST /api/cron/ingest-news` |
| ingest-social | `rate(30 minutes)` | Lambda → `POST /api/cron/ingest-social` |
| ingest-gov | `rate(1 day)` | Lambda → `POST /api/cron/ingest-gov` |
| analyze | `rate(1 hour)` | Lambda → `POST /api/cron/analyze` |

**Lambda function template:**
```javascript
const https = require('https');

exports.handler = async (event) => {
  const options = {
    hostname: 'newsreal.ai',
    path: '/api/cron/ingest-news',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
};
```

### Option B: Amplify Gen 2 Scheduled Functions

If using Amplify Gen 2, you can define scheduled functions in `amplify/functions/`:

```typescript
// amplify/functions/ingest-news/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const ingestNews = defineFunction({
  name: 'ingest-news',
  schedule: 'every 15m',
});
```

---

## Environment Variables

Set all env vars in **Amplify Console → App Settings → Environment Variables:**

```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
CONGRESS_API_KEY=xxx
REDDIT_CLIENT_ID=xxx
REDDIT_CLIENT_SECRET=xxx
CRON_SECRET=xxx  # Shared secret for cron Lambda auth
```

These are available during build and at runtime for SSR.

---

## Custom Domain Setup

1. In Amplify Console → **Domain Management** → **Add domain**
2. Enter `newsreal.ai`
3. Amplify handles SSL certificate provisioning automatically
4. Point your domain's nameservers or add CNAME records as directed by Amplify
5. Optionally configure `www.newsreal.ai` redirect

---

## Monitoring & Logging

Since you're in AWS, take advantage of:

- **CloudWatch Logs** — SSR function logs stream here automatically
- **CloudWatch Alarms** — set up alerts for error rates, latency spikes
- **X-Ray** — distributed tracing if you need to debug slow analysis pipelines
- **CloudWatch Metrics** — track Lambda invocation counts for cron jobs

---

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Amplify Hosting (SSR) | ~$15-30 |
| Lambda (cron invocations) | ~$1-2 |
| EventBridge | ~$0.50 |
| CloudWatch | ~$2-5 |
| **AWS Total** | **~$20-40** |

Combined with external services (Supabase, Upstash, Claude API), total
infrastructure cost is approximately **$130-250/month** at launch.
