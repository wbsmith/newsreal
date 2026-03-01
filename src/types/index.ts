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
  realAnalysis: string;
  deepDive: DeepDive;
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

export interface Obfuscation {
  category: string;
  whatHappened: string;
  whyItMatters: string;
  whatsCoveringIt: string;
  whoBenefits: string;
  detectionConfidence: number;
  sourceUrl?: string;
}

export interface Narrative {
  text: string;
  heat: string;
  coherenceScore?: number;
  outletsInvolved?: string[];
  slug?: string;
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
  relatedStories: { slug: string; headline: string }[];
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

export interface TickerItem {
  text: string;
  severity: Severity;
  linkType?: 'story' | 'narrative';
  linkRef?: string;
}
