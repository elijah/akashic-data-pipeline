export interface PolicySignal {
  focus: string;
  strength: number;
  evidence: string[];
  context?: string;
}

export interface PolicySignalCategory {
  name: string;
  keywords: string[];
}

export class PolicySignalAnalyzer {
  private readonly keywordDictionary: PolicySignalCategory[] = [
    {
      name: 'environment',
      keywords: [
        'climate', 'fracking', 'permit', 'pollution', 'wildlife', 'conservation',
        'EPA', 'emissions', 'greenhouse', 'carbon', 'greenhousegas', 'global',
        'warming', 'globalwarming', 'temperature', 'weather', 'precipitation',
        'rain', 'storm', 'hurricane', 'tornado', 'drought', 'flood', 'wildfire',
        'renewable', 'solar', 'wind', 'hydro', 'geothermal', 'clean'
      ]
    },
    {
      name: 'policing',
      keywords: [
        'crime', 'violence', 'assault', 'shooting', 'attack', 'stabbings',
        'riot', 'disturbance', 'police', 'policeofficer', 'lawenforcement',
        'security', 'arrest', 'felony', 'misdemeanor', 'probation',
        'jail', 'prison', 'reform', 'justice', 'criminal', 'felony',
        'indictment', 'case', 'charge', 'arrestwarrant', 'warrant',
        'taser', 'pepper', 'handcuff', 'cuff', 'cuffed', 'chain',
        'concern', 'alarm', 'suspicious', 'breakin', 'breakingin'
      ]
    },
    {
      name: 'governance',
      keywords: [
        'budget', 'economic', 'policy', 'legislation', 'vote', 'referendum',
        'initiative', 'proposition', 'ballot', 'candidates', 'campaign',
        'funding', 'appropriation', 'appropriations', 'spending',
        'tax', 'taxes', 'levy', 'revenue', 'fund', 'funds', 'grant',
        'earmark', 'earmarked', 'money', 'cash', 'disbursement',
        'appropriations', 'passed', 'passedbill', 'passedlaw',
        'constitution', 'amendment', 'democratic', 'majority',
        'coalition', 'caucus', 'senate', 'republican', 'democrat'
      ]
    }
  ];

  constructor() {}

  private normalizeKeyword(keyword: string): string {
    return keyword.toLowerCase().trim();
  }

  private calculateRelevanceScore(keyword: string, text: string): number {
    const normalizedKeyword = this.normalizeKeyword(keyword);
    const keywordFreq = (text.match(new RegExp(`\\b${normalizedKeyword}\\b`, 'gi')) || []).length;
    const totalWords = text.split(/\s+/).length;
    return keywordFreq / Math.max(totalWords || 1, 1);
  }

  async detectSignals(text: string): Promise<PolicySignal[]> {
    const normalizedText = text.toLowerCase();
    const signals: PolicySignal[] = [];

    for (const category of this.keywordDictionary) {
      let weightedCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of category.keywords) {
        const normalizedKeyword = this.normalizeKeyword(keyword);
        const count = (text.match(new RegExp(`\\b${normalizedKeyword}\\b`, 'gi')) || []).length;
        if (count > 0) {
          const relevanceScore = this.calculateRelevanceScore(keyword, text);
          weightedCount += count * relevanceScore;
          matchedKeywords.push(keyword);
        }
      }

      if (weightedCount > 0.5) {
        const strength = Math.min(1, weightedCount / 10);
        const contextMatch = text.match(new RegExp(matchedKeywords.filter(k => text.toLowerCase().includes(k.toLowerCase())).join('|'), 'gi'));
        signals.push({
          focus: category.name,
          strength,
          evidence: matchedKeywords,
          context: contextMatch?.[0] || ''
        });
      }
    }

    return signals;
  }
}

export const policySignalAnalyzer = new PolicySignalAnalyzer();