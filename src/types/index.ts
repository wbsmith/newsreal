export type BiasTag =
  | 'LEAN LEFT'
  | 'LEAN RIGHT'
  | 'ESTABLISHMENT'
  | 'ANTI-ESTABLISHMENT'
  | 'UNREPORTED'
  | 'CENTER-ESTABLISHMENT';

export type BiasClass = 'left' | 'right' | 'center' | 'establishment';

export type Category = 'politics' | 'tech' | 'finance' | 'world' | 'science' | 'deep-state';

export type Severity = 'high' | 'med' | 'low';

export interface StoryBiasTag {
  label: BiasTag;
  class: BiasClass;
}

export interface DeepDive {
  mainstream: string;
  realStory: string;
  leftSpin: string;
  rightSpin: string;
  whosBenefiting: string;
  whatsHidden: string;
}

export interface ManipulationSubScore {
  score: number;
  reason: string;
}

export interface ManipulationBreakdown {
  emotional_manipulation: ManipulationSubScore;
  source_transparency: ManipulationSubScore;
  framing_bias: ManipulationSubScore;
  selective_omission: ManipulationSubScore;
  headline_accuracy: ManipulationSubScore;
}

export interface Story {
  id: number;
  slug: string;
  category: Category;
  featured?: boolean;
  source: string;
  sourceUrl: string;
  time: string;
  headline: string;
  summary: string;
  biasTag: StoryBiasTag;
  manipulationScore: number;
  manipulationBreakdown?: ManipulationBreakdown;
  hasFullText?: boolean;
  realAnalysis: string;
  deepDive: DeepDive;
  sourceNetwork?: SourceNetwork;
}

export interface Analysis {
  id: string;
  clusterId: string;
  manipulationIndex: number;
  manipulationReasoning: string;
  biasTag: BiasTag;
  quickTake: string;
  mainstreamFrame: string;
  realStory: string;
  leftSpin: string;
  rightSpin: string;
  whoBenefits: string;
  whatsHidden: string;
  redactedElements: { text: string; revealedText: string }[];
  generatedAt: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
}

export interface SourceArticle {
  slug: string;
  headline: string;
  sourceUrl: string;
}

export interface Obfuscation {
  category: string;
  whatHappened: string;
  whyItMatters: string;
  whatsCoveringIt: string;
  whoBenefits: string;
  detectionConfidence: number;
  sourceUrl?: string;
  relatedStories?: SourceArticle[];
}

export interface CoherenceBreakdown {
  lexical_alignment: number;
  frame_uniformity: number;
  source_convergence: number;
  counter_narrative_absence: number;
}

export interface Narrative {
  text: string;
  heat: string;
  coherenceScore?: number;
  coherenceBreakdown?: CoherenceBreakdown;
  outletsInvolved?: string[];
  slug?: string;
  relatedStories?: SourceArticle[];
}

export interface NarrativeAnalysis {
  slug: string;
  narrativeText: string;
  coherenceScore: number;
  outletsInvolved: string[];
  analysisDate: string;
  narrativeOrigin: string;
  coordinationEvidence: string;
  whoBenefits: string;
  suppressedAlternative: string;
  relatedStories: SourceArticle[];
}

export interface SuppressedSearch {
  query: string;
}

export interface SearchAnalysis {
  query: string;
  resultCount: number;
  analysisDate: string;
  mediaPattern: string;
  whatsRevealed: string;
  whatsMissing: string;
  connectionMap: string;
  whyItsSuppressed: string;
  searchResults: { title: string; source: string; link: string; snippet: string }[];
}

export interface SuppressedSearchEntry {
  query: string;
  analysis: SearchAnalysis | null;
}

export interface SourceNetworkEntry {
  source: string;
  headline: string;
  sourceUrl: string;
  similarity: number;
  timeDelta: string;
}

export interface SourceNetwork {
  outletCount: number;
  entries: SourceNetworkEntry[];
}

export interface TickerItem {
  text: string;
  severity: Severity;
  linkType?: 'story' | 'narrative';
  linkRef?: string;
}
