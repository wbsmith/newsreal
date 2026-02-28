# NewsReal.ai — Getting Started

## Prerequisites

- Node.js 18+
- npm or yarn
- AWS account with Amplify access
- GitHub repo for the project

---

## 1. Create the Project

```bash
npx create-next-app@latest newsreal-ai --typescript --tailwind --app --src-dir --import-alias "@/*"
cd newsreal-ai
```

## 2. Install Dependencies

```bash
# Core
npm install @anthropic-ai/sdk @supabase/supabase-js @upstash/redis

# Ingestion
npm install rss-parser cheerio fuzzball date-fns

# Dev
npm install -D @types/node
```

## 3. Set Up Project Files

Copy these files into the project root:
- `CLAUDE.md` → project root (Claude Code context)
- `newsreal-prototype.html` → project root (design reference)
- `DATABASE_SCHEMA.sql` → project root (for reference)

## 4. Environment Variables

Create `.env.local`:

```env
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Government APIs
CONGRESS_API_KEY=

# Social APIs
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# Cron authentication
CRON_SECRET=

# App
NEXT_PUBLIC_SITE_URL=https://newsreal.ai
```

## 5. Set Up Database

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor
3. Run the contents of `DATABASE_SCHEMA.sql`

## 6. Configure Next.js for Amplify

Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: false,
  },
}
module.exports = nextConfig
```

Create `amplify.yml` in project root:

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

## 7. Deploy to AWS Amplify

1. Push code to GitHub
2. Go to AWS Amplify Console → **New app** → **Host web app**
3. Connect your GitHub repo
4. Amplify auto-detects Next.js
5. Add all environment variables from `.env.local`
6. Deploy

## 8. Set Up Custom Domain

1. Amplify Console → **Domain Management**
2. Add `newsreal.ai`
3. Follow DNS configuration instructions

## 9. Set Up Cron Jobs

See `AWS_AMPLIFY_DEPLOYMENT.md` for full details on EventBridge + Lambda setup.

---

## API Keys to Obtain

| Service | Where to Get It | Notes |
|---------|----------------|-------|
| Anthropic API | https://console.anthropic.com | Need billing set up |
| Supabase | https://supabase.com | Free tier works to start |
| Upstash Redis | https://upstash.com | Free tier works to start |
| Congress.gov API | https://api.congress.gov/sign-up/ | Free |
| Reddit API | https://www.reddit.com/prefs/apps | Create "script" app |
| Federal Register | No key needed | Free public API |

---

## Development Workflow

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Test production build locally
npm start
```

When working with Claude Code, point it to `CLAUDE.md` and `AI_PROMPTS.md`
for context on how to generate analysis content.
