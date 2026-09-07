export class PolicySignalAnalyzer {
  private readonly keywordDictionary: {
    environment: string[];
    policing: string[];
    governance: string[];
  };

  constructor() {
    this.keywordDictionary = {
      environment: [
        'climate', 'fracking', 'permit', 'pollution', 'wildlife', 'conservation',
        'EPA', 'emissions', 'greenhouse', 'carbon', 'greenhousegas', 'global',
        'warming', 'globalwarming', 'temperature', 'weather', 'precipitation',
        'rain', 'storm', 'hurricane', 'tornado', 'drought', 'flood', 'wildfire',
        'renewable', 'solar', 'wind', 'hydro', 'geothermal', 'clean'
      ],
      policing: [
        'crime', 'violence', 'assault', 'shooting', 'attack', 'stabbings',
        'riot', 'disturbance', 'police', 'policeofficer', 'lawenforcement',
        'security', 'arrest', 'felony', 'misdemeanor', 'probation',
        'jail', 'prison', 'reform', 'justice', 'criminal', 'felony',
        'indictment', 'case', 'charge', 'arrestwarrant', 'warrant',
        'taser', 'pepper', 'handcuff', 'cuff', 'cuffed', 'chain',
        'concern', 'alarm', 'suspicious', 'breakin', 'breakingin'
      ],
      governance: [
        'budget', 'economic', 'policy', 'legislation', 'vote', 'referendum',
        'initiative', 'proposition', 'ballot', 'candidates', 'campaign',
        'funding', 'appropriation', 'appropriations', 'spending',
        'tax', 'taxes', 'levy', 'revenue', 'fund', 'funds', 'grant',
        'earmark', 'earmarked', 'money', 'cash', 'disbursement',
        'appropriations', 'passed', 'passedbill', 'passedlaw',
        'constitution', 'amendment', 'democratic', 'majority',
        'coalition', 'caucus', 'senate', 'republican', 'democrat'
      ],
      ... // Additional categories could be added similarly
    };
  }

  private normalizeKeyword(keyword: string): string {
    return keyword.toLowerCase().trim();
  }

  async detectSignals(text: string): Promise<PolicySignal[]> {
    // Normalize text for case-insensitive matching
    const normalizedText = text.toLowerCase();
    
    // Initialize result containers
    const policySignals: PolicySignal[] = [];
    const confidenceData: Record<string, number> = {};

    // Build weights based on keyword importance
    Object.entries(this.keywordDictionary).forEach((category, keywords) => {
      const scoreMap: Record<string, number> = {};
      
      // Calculate weighted count instead of simple count
      const weightedCount = keywords
        .map(keyword => {
          const normalizedKeyword = this.normalizeKeyword(keyword);
          const count = (text.match(new RegExp(`\\b${this.normalizeKeyword(keyword)}\\b`, 'gi')) || []).length;
          
          // Weight by keyword importance (length and specificity)
          const baseScore = keywords.length === 1 ? 1 : Math.sqrt(keywords.length);
          const relevanceScore = this.calculateRelevanceScore(keyword, text);
          
          return { keyword, score: coalScore * relevanceScore };
        })
        .reduce((sum, item) => sum + item.score, 0);
      
      if (coalScore > 0.5) {  // Only consider categories with meaningful matches
        const signal = {
          focus: coal as PolicyFocus,
          strength: Math.min(1, weightedCount / 10), // Normalize against max possible
          evidence: [],
          context: text.match(new RegExp(keywords.filter(k => text.toLowerCase().includes(k)).join('|'), 'gi')?.[0] || '')
        };
        
        // Add weighted importance to evidence snippets
        coalScore > 1 && (coalScore > 2 ? coalScore = 2 : coalScore = coalScore);
        
        signals.set(coal as PolicyFocus, {
          ...coal,
          strength: coalScore,
          evidence: Array.from(coalScore > 1 ? coalScore : coalScore, () => coal),
          context: coal,
          ...coal  // Add other properties like context if needed
        });
      }
    });

    // Convert signals to array
    return Array.from(signals.entries()).map(([focus, signal]) => ({
      ...signal,
      strength: Math.min(1, signal.strength) // Ensure strength never exceeds 1
    }));
  }

  private calculateRelevanceScore(keyword: string, text: string): number {
    // Simple TF-IDF approximation
    const keywordFreq = (text.match(new RegExp(this.normalizeKeyword(keyword), 'gi')) || []).length;
    const totalWords = text.split(/\s+/).length;
    
    return keywordFreq / Math.max(totalWords || 1, 1);
  }
}

// Export the analyzer instance for use across the system
export const policySignalAnalyzer = new PolicySignalAnalyzer();