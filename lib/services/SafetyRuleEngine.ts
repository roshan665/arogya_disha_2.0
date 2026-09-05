import { supabase } from '../supabaseClient';

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';

export class SafetyRuleEngine {
  /**
   * Deterministic Rule Engine logic. 
   * In a real system, this would parse conditions from the `safety_rules` table.
   * For this implementation, we hardcode the baseline fallback rules to guarantee safety.
   */
  static evaluateContext(vitals: any, symptoms: string[]): RiskLevel {
    let score = 0;

    if (vitals.temperature && vitals.temperature > 100) score += 1;
    if (vitals.temperature && vitals.temperature > 103) score += 3;
    
    if (symptoms.includes('chest_pain') || symptoms.includes('breathlessness')) score += 5;
    if (symptoms.includes('continuous_fever') || symptoms.includes('severe_weakness')) score += 2;

    if (score >= 5) return 'CRITICAL';
    if (score >= 3) return 'RED';
    if (score >= 1) return 'YELLOW';
    return 'GREEN';
  }

  /**
   * Conflict Resolution: The AI is strictly PROHIBITED from downgrading a safety rule.
   * We return the maximum severity of the two.
   */
  static resolveConflict(ruleSeverity: RiskLevel, aiSeverity: RiskLevel): RiskLevel {
    const levels = { 'GREEN': 1, 'YELLOW': 2, 'RED': 3, 'CRITICAL': 4 };
    
    if (levels[aiSeverity] > levels[ruleSeverity]) {
      return aiSeverity; // AI can escalate
    }
    return ruleSeverity; // AI CANNOT downgrade
  }
}
