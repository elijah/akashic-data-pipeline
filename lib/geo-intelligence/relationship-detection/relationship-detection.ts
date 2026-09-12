import { RelationshipDetector, DetectedRelationship } from './relationship-detector';

export async function detectNestedSignals(
  policySignals: any[],
  context: string
): Promise<DetectedRelationship[]> {
  const detector = new RelationshipDetector();
  return detector.detectNestedSignals(policySignals, context);
}

export async function enrichWithNestedRelations(
  biSignal: any,
  text: string
): Promise<any> {
  const detector = new RelationshipDetector();
  
  // Extract base signals from the biSignal
  const baseSignals = biSignal.signals || biSignal.policySignals || [];
  
  // Extract context themes (simple keyword extraction)
  const contextThemes = extractContextThemes(text);
  
  // Detect relationships between signals
  const nestedRelations = await detectNestedSignals(baseSignals, text);
  
  // Return enriched perspective object
  return {
    ...biSignal,
    nestedRelations: nestedRelations,
    contextThemes: contextThemes,
    relationshipStrength: calculateRelationshipStrength(baseSignals)
  };
}

function extractContextThemes(text: string): string[] {
  const keywords = [
    'government', 'election', 'policy', 'budget', 'infrastructure',
    'environment', 'health', 'education', 'security', 'economy',
    'technology', 'healthcare', 'transportation', 'energy', 'climate'
  ];
  return keywords.filter(k => text.toLowerCase().includes(k.toLowerCase()));
}

function calculateRelationshipStrength(signals: any[]): number {
  if (!signals || signals.length === 0) return 0;
  const avgStrength = signals.reduce((sum, s) => sum + (s.strength || 0), 0) / signals.length;
  return Math.min(1, avgStrength);
}