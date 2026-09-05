import { RiskLevel } from './SafetyRuleEngine';

export interface AIRecommendationResult {
  recommendation: RiskLevel;
  reason: string;
  key_observations: string[];
  suggested_next_step: string;
  is_fallback: boolean;
}

export class AIServiceClient {
  private static AI_URL = 'http://127.0.0.1:8000/api/v1/recommendation';

  /**
   * Calls the isolated Python FastAPI AI service.
   * If the service fails, times out, or returns a 500, it safely falls back to a neutral response.
   */
  static async getRecommendation(vitals: any, symptoms: string[], ruleSeverity: string): Promise<AIRecommendationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Strict 3 second timeout for AI

      const response = await fetch(this.AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vitals, symptoms, rule_engine_severity: ruleSeverity }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI Service returned ${response.status}`);
      }

      const data = await response.json();
      return {
        ...data,
        is_fallback: false
      };
    } catch (error) {
      console.warn("AI Service Failure. Falling back to deterministic rules.", error);
      // AI Failure logic: Return a neutral payload that will not escalate the Rule Engine's decision.
      return {
        recommendation: 'GREEN',
        reason: 'AI Service Unavailable. Relied entirely on internal rule engine.',
        key_observations: [],
        suggested_next_step: 'Proceed with deterministic rule guidelines.',
        is_fallback: true
      };
    }
  }
}
