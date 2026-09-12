import { policySignalAnalyzer } from '../policy-engine/policy-signal-analyzer';

export interface CourtSignals {
  magnitude: 'low' | 'medium_to_high';
  approach: string;
  confidence: number;
  signals: Record<string, number>;
}

export interface Signals {
  magnitude: string;
  approach: string;
  confidence: number;
  signals: Record<string, number>;
}

export interface RawCourtData {
  canonicalForm: {
    context?: {
      perspective?: Record<string, unknown>;
    };
  };
  source: string;
  metadata?: Record<string, unknown>;
}

export interface CivicEntity {
  id: string;
  source: string;
  timestamp: string;
  reliability: number;
  title: string;
  date: string;
  content: string;
  outcomes: unknown[];
  voteResult: string;
  type: string;
  engagementScore: number;
  numComments: number;
  [key: string]: unknown;
}

async function extractPolicySignals(text: string): Promise<unknown[]> {
  const signals = await policySignalAnalyzer.detectSignals(text);
  return signals.map(s => ({ focus: s.focus, strength: s.strength, evidence: s.evidence }));
}

async function extractCrimeCategories(text: string): Promise<string[]> {
  const signals = await policySignalAnalyzer.detectSignals(text);
  return signals.filter(s => s.focus === 'policing' || s.focus === 'governance').map(s => s.focus);
}

function extractCourtText(rawData: RawCourtData): string {
  return JSON.stringify(rawData.canonicalForm) + ' ' + rawData.source;
}

export async function extractCourtSignals(caseText: string): Promise<CourtSignals> {
  const policySignals = await extractPolicySignals(caseText);
  const crimeCategories = await extractCrimeCategories(caseText);

  const hasPolicing = crimeCategories.includes('policing');

  return {
    magnitude: hasPolicing ? 'medium_to_high' : 'low',
    approach: hasPolicing ? 'enforcement_focused' : 'documentary',
    confidence: 0.5,
    signals: {}
  };
}

export async function processCourtDocument(rawData: RawCourtData): Promise<CivicEntity[]> {
  const rawText = extractCourtText(rawData);
  const signals = await extractCourtSignals(rawText);

  const civicEntity: CivicEntity = {
    id: `court-${Date.now()}`,
    source: rawData.source,
    timestamp: new Date().toISOString(),
    reliability: signals.confidence,
    title: 'Court Document Analysis',
    date: new Date().toISOString(),
    content: rawText,
    outcomes: [],
    voteResult: '',
    type: 'court_analysis',
    engagementScore: signals.confidence,
    numComments: 0
  };

  return [civicEntity];
}