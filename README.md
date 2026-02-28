# NewsReal.ai — Project Plan Archive

## Files in This Archive

| File | Description |
|------|-------------|
| `CLAUDE.md` | **Claude Code project context file.** Place at repo root. Governs AI behavior for analysis generation. |
| `IMPLEMENTATION_PLAN.md` | **Master plan.** Architecture, data sources, analysis pipeline, frontend spec, phased rollout. |
| `GETTING_STARTED.md` | **Quickstart guide.** Step-by-step setup: project creation, dependencies, env vars, deployment. |
| `AWS_AMPLIFY_DEPLOYMENT.md` | **Deployment guide.** Amplify config, cron via EventBridge+Lambda, domain setup, monitoring. |
| `DATABASE_SCHEMA.sql` | **PostgreSQL schema.** Run in Supabase SQL editor to create all tables and indexes. |
| `AI_PROMPTS.md` | **All Claude API prompts.** Story analysis, obfuscation detection, narrative tracking, classification, ticker, suppressed searches. |
| `SERVICES_AND_COSTS.md` | **Services reference.** All APIs needed, where to sign up, cost estimates. |
| `newsreal-prototype.html` | **Working UI prototype.** Open in browser. This is the definitive design reference for the production build. |

## How to Use

1. Start with `GETTING_STARTED.md` for project setup
2. Copy `CLAUDE.md` to your repo root for Claude Code context
3. Run `DATABASE_SCHEMA.sql` in your Supabase instance
4. Reference `IMPLEMENTATION_PLAN.md` for architecture decisions
5. Use `AI_PROMPTS.md` when building `src/lib/analysis/prompts.ts`
6. Follow `AWS_AMPLIFY_DEPLOYMENT.md` for deploy + cron setup
7. Open `newsreal-prototype.html` in a browser as design reference
