-- ═══════════════════════════════════════════════════════════
-- NewsReal.ai — Database Schema
-- Run in Supabase SQL Editor or any PostgreSQL instance
-- ═══════════════════════════════════════════════════════════

-- Core stories table
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID, -- groups related coverage of the same event
  headline TEXT NOT NULL,
  summary TEXT,
  full_text TEXT,
  source_name VARCHAR(100),
  source_url TEXT,
  category VARCHAR(50), -- politics, tech, finance, world, science, deep-state
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB -- original API response
);

-- AI analysis for each story cluster
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID,
  manipulation_index INTEGER,
  manipulation_reasoning TEXT,
  bias_tag VARCHAR(50),
  quick_take TEXT,
  mainstream_frame TEXT,
  real_story TEXT,
  left_spin TEXT,
  right_spin TEXT,
  who_benefits TEXT,
  whats_hidden TEXT,
  redacted_elements JSONB, -- [{text, revealed_text}]
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_used VARCHAR(50),
  prompt_tokens INTEGER,
  completion_tokens INTEGER
);

-- Obfuscation index entries (buried stories)
CREATE TABLE obfuscations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100), -- TREASURY, DOD, EPA, etc.
  what_happened TEXT,
  why_it_matters TEXT,
  whats_covering_it TEXT,
  who_benefits TEXT,
  detection_confidence INTEGER,
  source_url TEXT,
  source_type VARCHAR(50), -- federal_register, congress, sec, etc.
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Narrative tracking (coordinated messaging detection)
CREATE TABLE narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_text TEXT,
  coherence_score INTEGER,
  related_cluster_ids UUID[],
  outlets_involved TEXT[],
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Government filings (raw data for cross-referencing)
CREATE TABLE gov_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50), -- federal_register, congress, sec, pacer
  title TEXT,
  summary TEXT,
  document_url TEXT,
  filed_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB,
  coverage_count INTEGER DEFAULT 0 -- how many news stories reference this
);

-- Social sentiment snapshots
CREATE TABLE social_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(50),
  topic TEXT,
  sentiment_score FLOAT, -- -1 to 1
  volume INTEGER,
  bot_ratio_estimate FLOAT,
  top_posts JSONB,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════

CREATE INDEX idx_stories_cluster ON stories(cluster_id);
CREATE INDEX idx_stories_category ON stories(category);
CREATE INDEX idx_stories_published ON stories(published_at DESC);
CREATE INDEX idx_analyses_cluster ON analyses(cluster_id);
CREATE INDEX idx_obfuscations_detected ON obfuscations(detected_at DESC);
CREATE INDEX idx_gov_filings_filed ON gov_filings(filed_at DESC);
CREATE INDEX idx_gov_filings_coverage ON gov_filings(coverage_count);
