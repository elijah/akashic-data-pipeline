export interface DetectedRelationship {
  sourceSignalId: string;
  targetSignalId: string;
  relationshipType: 'co-occurrence' | 'causation' | 'contradiction' | 'reinforcement';
  strength: number;
  evidence: string[];
}

export class RelationshipDetector {
  // Policy domain keyword hierarchies for nested signal detection
  private policyHierarchy = {
    environment: [
      'climate', 'fracking', 'permit', 'pollution', 'wildlife', 'conservation',
      'EPA', 'emissions', 'greenhouse', 'global', 'warming', 'temperature', 'precipitation',
      'rain', 'storm', 'hurricane', 'tornado', 'drought', 'flood', 'wildfire',
      'renewable', 'solar', 'wind', 'hydro', 'geothermal', 'clean'
    ],
    policing: [
      'crime', 'violence', 'assault', 'shooting', 'attack', 'permit', 'officer', 'arrest',
      'felony', 'misdemeanor', 'probation', 'jail', 'prison', 'protest', 'riot', 'agitation',
      'bias', 'racist', 'racial', 'tension', 'protest', 'demonstration', 'militarized',
      'force', 'weapon', 'firearm', 'gun', 'arm', 'taser',
      'community', 'trust', 'accountability', 'oversight', 'investigation',
      'caught', 'caught.city', 'caught.city', 'officer', 'badge', 'uniform'
    ],
    governance: [
      'budget', 'election', 'campaign', 'vote', 'referendum', 'petition',
      'ballot', 'initiative', 'proposal', 'law', 'legislature',
      'congress', 'senate', 'house', 'caucus', 'coalition', 'majority',
      'approval', 'majority', 'opposition', 'opposition party', 'bipartisan'
    ]
  };

  /**
   * Detects co-occurrence relationships between signals that appear in the same sentence
   */
  detectRelationships(signals: any[], text: string): DetectedRelationship[] {
    const relationships: DetectedRelationship[] = [];
    
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    sentences.forEach(sentence => {
      const sentenceLower = sentence.toLowerCase();
      const signalsInSentence = signals.filter(signal => 
        signal.evidence?.some(evidence => 
          sentence.toLowerCase().includes(evidence.toLowerCase())
        )
      );
      
      if (signalsInSentence.length > 1) {
        for (let i = 0; i < signalsInSentence.length; i++) {
          for (let j = i + 1; j < signalsInSentence.length; j++) {
            relationships.push({
              sourceSignalId: signalsInSentence[i].id,
              targetSignalId: signalsInSentence[j].id,
              relationshipType: 'co-occurrence',
              strength: this.calculateCoOccurrenceStrength(signalsInSentence[i], signalsInSentence[j], sentence),
              evidence: [sentence.trim()]
            });
          }
        }
      }
    });
    
    return relationships;
  }
  
  /**
   * Detects nested/hierarchical relationships between signals
   * e.g., a broad policy area like "environment" containing specific topics like "water quality"
   */
  detectNestedSignals(signals: any[], text: string): DetectedRelationship[] {
    const relationships: DetectedRelationship[] = [];
    const textLower = text.toLowerCase();
    
    // For each signal, check if its evidence contains more specific sub-topics
    signals.forEach(signal => {
      // Determine the policy domain of this signal based on evidence keywords
      const domain = this.inferPolicyDomain(signal);
      if (!domain) return;
      
      // Get sub-topics for this domain
      const subTopics = this.policyHierarchy[domain] || [];
      
      // Look for sub-topic mentions in the text
      subTopics.forEach(subTopic => {
        if (textLower.includes(subTopic.toLowerCase())) {
          // Create a relationship from the broad signal to the specific sub-topic
          // We'll treat this as a "specialization" relationship
          relationships.push({
            sourceSignalId: signal.id,
            targetSignalId: `${signal.id}-sub-${subTopic.replace(/\s+/g, '-')}`,
            relationshipType: 'reinforcement', // Specialization reinforces the broader category
            strength: 0.8, // High confidence for exact substring match
            evidence: [subTopic]
          });
        }
      });
    });
    
    return relationships;
  }
  
  /**
   * Infers the policy domain of a signal based on its evidence keywords
   */
  private inferPolicyDomain(signal: any): 'environment' | 'policing' | 'governance' | null {
    const evidenceText = (signal.evidence || []).join(' ').toLowerCase();
    
    // Count matches for each domain
    const scores = {
      environment: this.countKeywordMatches(evidenceText, this.policyHierarchy.environment),
      policing: this.countKeywordMatches(evidenceText, this.policyHierarchy.policing),
      governance: this.countKeywordMatches(evidenceText, this.policyHierarchy.governance)
    };
    
    // Return the domain with the highest score (if any matches)
    const maxScore = Math.max(scores.environment, scores.policing, scores.governance);
    if (maxScore === 0) return null;
    
    if (scores.environment === maxScore) return 'environment';
    if (scores.policing === maxScore) return 'policing';
    return 'governance';
  }
  
  /**
   * Counts how many keywords from a list appear in the text
   */
  private countKeywordMatches(text: string, keywords: string[]): number {
    return keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;
  }
  
  private calculateCoOccurrenceStrength(
    signalA: any, 
    signalB: any, 
    sentence: string
  ): number {
    const words = sentence.split(/\s+/);
    const positions = [
      words.findIndex(pos => 
        words[pos]?.toLowerCase().includes(signalA.evidence?.toLowerCase() || '')
      ),
      words.findIndex(pos => 
        words[pos]?.toLowerCase().includes(signalB.evidence?.toLowerCase() || '')
      )
    ];
    
    const distance = Math.abs(
      positions[0] - positions[1]
    );
    
    const maxDistance = words.length;
    const proximityScore = 1 - (distance / maxDistance);
    
    return (1 + this.strengthAverage(signalA.strength, signalB.strength)) * proximityScore;
  }
  
  private strengthAverage(strengthA: number, strengthB: number): number {
    return (strengthA + strengthB) / 2;
  }
}