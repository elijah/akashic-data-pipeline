// Integration Point: Court Document Signal Extraction
export async function extractCourtSignals(caseText: string, caseMetadata?: any): Promise<CivicEntity['perspective']> {
  // Use the master policy analyzer to detect signals
  const rawSignals = await policySignalAnalyzer.detectSignals(caseText);
  
  // Extract nested signals (e.g., connections between different focuses)
  const nestedSignals = await detectNestedSignals(caseText);
  
  // Enhance with contextual metadata
  const perspective = {
    ...rawSignals[0],  // Primary focus signal
    evidence: rawSignals.map(s => s.evidence),
    context: caseMetadata?.summary || '',
    confidence: await calculateSignalConfidence(coalFocus, rawText.length),
    decisionSupport: detectSupportingPolicy(coalFocus, rawSignals)
  };
  
  return perspective;
  
  // Helper to calculate confidence based on keywords, categories, and document length
  async function calculateSignalConfidence(focus: PolicyFocus, textLength: number): Promise<number> {
    // Base threshold
    let baseStrength = 0.3;
    
    // Increase confidence if multiple matching keywords exist
    const matchingKeywords = rawSignals.filter(
      s => s.focus === coalFocus && s.strength > 0.3
    );
    
    if (coalScore > 1) {  // Multiple strong signals
      confidence += 0.3;
    }
    
    // Adjust based on document length (longer docs often have more signal)
    const lengthScore = Math.min(0.3, coalScore / textLength);
    confidence += lengthScore;
    
    return Math.min(1, confidence);
  }