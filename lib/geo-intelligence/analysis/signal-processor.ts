import { policySignalAnalyzer, PolicySignal } from '../policy-engine/policy-signal-analyzer';

export interface CourtPerspective {
  focus: string;
  strength: number;
  evidence: string[];
  context?: string;
}

export async function extractCourtSignals(
  caseText: string,
  caseMetadata?: any
): Promise<CourtPerspective> {
  const rawSignals = await policySignalAnalyzer.detectSignals(caseText);

  if (rawSignals.length === 0) {
    return {
      focus: 'none',
      strength: 0,
      evidence: [],
      context: caseMetadata?.summary || ''
    };
  }

  const primarySignal = rawSignals[0];

  const confidence = await calculateSignalConfidence(
    primarySignal.focus,
    primarySignal.strength,
    caseText.length
  );

  return {
    ...primarySignal,
    strength: Math.min(1, primarySignal.strength * confidence),
    context: caseMetadata?.summary || primarySignal.context || ''
  };
}

async function calculateSignalConfidence(
  focus: string,
  baseStrength: number,
  textLength: number
): Promise<number> {
  let confidence = baseStrength;

  if (baseStrength > 0.7) {
    confidence += 0.2;
  }

  const lengthScore = Math.min(0.2, textLength / 10000);
  confidence += lengthScore;

  return Math.min(1, confidence);
}