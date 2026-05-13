// Prototype headlines per category. Embedded once at startup, averaged into
// per-category centroids. Used as a cheap pre-filter before LLM classification.
//
// Tuning: aim for headlines that exemplify the *kind of story* each category
// captures, not just the topic. "Deep-state" specifically targets coverage
// patterns of intel/regulatory/buried actions, not just defense topics.

export const CATEGORY_PROTOTYPES: Record<string, string[]> = {
  politics: [
    'Senate passes sweeping immigration reform bill in late-night vote',
    'Supreme Court hears arguments on presidential immunity',
    'DOJ launches investigation into campaign finance violations',
    'Governor signs new abortion restrictions into law',
    'Federal judge blocks executive order on border policy',
    'Congressional hearing on Big Tech antitrust gets heated',
    'Senator proposes bipartisan infrastructure compromise',
    'White House announces new climate executive action',
  ],
  tech: [
    'OpenAI announces new GPT model with multimodal capabilities',
    'Google releases major update to search algorithm',
    'Apple unveils latest iPhone with improved AI features',
    'Cybersecurity researchers discover critical vulnerability in widely-used software',
    'Meta launches new AI-powered content moderation tools',
    'Startup raises $100M Series B for autonomous vehicle technology',
    'Tech CEO testifies before Congress about platform algorithms',
    'Major data breach exposes millions of user records',
  ],
  finance: [
    'Fed raises interest rates by 25 basis points amid inflation concerns',
    'Stock market hits new all-time high on strong earnings reports',
    'Major bank reports record quarterly profits driven by trading revenue',
    'Bitcoin price surges past $100,000 on institutional adoption',
    'Treasury yields jump as investors brace for stronger growth',
    'Hedge fund announces major position in struggling retailer',
    'SEC charges crypto exchange with securities violations',
    'Corporate earnings beat expectations as consumer spending holds up',
  ],
  world: [
    'Russia and Ukraine reach tentative ceasefire agreement',
    'Major earthquake strikes coastal city, hundreds feared dead',
    'China announces new military exercises near Taiwan',
    'European Union finalizes deal on climate emissions',
    'Israeli forces conduct operation in disputed territory',
    "Iran's foreign minister meets with European leaders over nuclear deal",
    'African Union holds emergency summit on regional conflicts',
    'Mexico cartel violence prompts new US border policy debate',
  ],
  science: [
    "NASA's Artemis mission successfully orbits the moon",
    'Scientists discover potential cure for aggressive cancer in clinical trials',
    'Climate study finds Arctic ice melting faster than predicted',
    'Researchers identify new species of deep-sea fish near hydrothermal vents',
    'Quantum computing breakthrough achieves error-correction milestone',
    'Astronomers detect mysterious radio signals from distant galaxy',
    'Mars rover finds evidence of ancient water on red planet',
    'Gene therapy trial shows promising results for rare disease',
  ],
  'deep-state': [
    'FBI surveillance program targeting domestic activists revealed by whistleblower',
    'Pentagon quietly approves new black-budget program with minimal disclosure',
    'ATF rule change buried in Federal Register imposes sweeping new restrictions',
    'Former intelligence official admits to past covert operations in memoir',
    'Treasury sanctions list expanded amid limited press coverage',
    'Congressional committee classified hearings on intelligence overreach',
    'CIA-funded venture capital arm makes notable defense-tech investment',
    'DOJ inspector general report finds widespread surveillance abuses',
  ],
};

export const CATEGORIES = Object.keys(CATEGORY_PROTOTYPES);
