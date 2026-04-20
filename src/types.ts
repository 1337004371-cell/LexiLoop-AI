export type Category = 'Workplace' | 'Daily' | 'Travel' | 'Shopping' | 'Other';

export interface Example {
  sentence: string;
  translation: string;
}

export interface Collocation {
  phrase: string;
  translation: string;
}

export interface Word {
  id: string;
  text: string;
  ukPhonetic?: string;
  usPhonetic?: string;
  pos?: string; // e.g. "adj.", "noun"
  definition: string;
  category: Category;
  examples: Example[];
  collocations?: Collocation[];
  createdAt: number;
  lastReviewedAt?: number;
  masteryLevel: number; // 0 to 5
  tags: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  suggestedPhrases?: string[];
  feedback?: string; // AI feedback on user's specific expression
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  category: Category;
  systemPrompt: string;
  initialMessage: string;
}
