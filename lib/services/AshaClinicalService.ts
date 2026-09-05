import { AshaWorkflowRepository, VisitData } from '../repositories/AshaWorkflowRepository';
import { SafetyRuleEngine } from './SafetyRuleEngine';
import { AIServiceClient } from './AIServiceClient';
import { supabase } from '../supabaseClient';

export class AshaClinicalService {

  /**
   * Orchestrates the Checkup Flow: Rule Engine -> AI Service -> Conflict Resolution -> Override -> Audit Log
   */
  static async completeCheckup(
    visitData: VisitData, 
    autoFollowUp: boolean = true, 
    overrideReason?: string
  ) {
    // 1. Deterministic Rule Engine
    const ruleSeverity = SafetyRuleEngine.evaluateContext(visitData.vitals, visitData.symptoms);

    // 2. AI Recommendation Service (Isolated)
    const aiResult = await AIServiceClient.getRecommendation(visitData.vitals, visitData.symptoms, ruleSeverity);

    // 3. Conflict Resolution
    // AI cannot downgrade safety rules.
    let finalSystemDecision = SafetyRuleEngine.resolveConflict(ruleSeverity, aiResult.recommendation);

    // 4. ASHA Override Processing
    let finalDecision = finalSystemDecision;
    let isOverridden = false;

    if (overrideReason && visitData.risk_score !== finalSystemDecision) {
      finalDecision = visitData.risk_score;
      isOverridden = true;
    } else {
      visitData.risk_score = finalDecision; // Update visit data to reflect system decision if no override
    }

    // 5. Log the visit to the database
    const visit = await AshaWorkflowRepository.logVisit(visitData);

    // 6. Audit Trail for AI / Rules
    const { error: aiAuditError } = await supabase.from('ai_audit_logs').insert({
      visit_id: visit.id,
      rule_version_snapshot: { version: '1.0', rule_applied: ruleSeverity },
      ai_model_version: aiResult.is_fallback ? 'FAIL_FALLBACK' : 'AI_v1',
      input_snapshot: { vitals: visitData.vitals, symptoms: visitData.symptoms },
      ai_recommendation: aiResult.recommendation,
      ai_reason: aiResult.reason,
      rule_recommendation: ruleSeverity,
      final_decision: finalDecision,
      is_overridden: isOverridden,
      override_reason: overrideReason,
      actor_id: visitData.asha_id
    });

    if (aiAuditError) {
      console.error("Critical Failure: AI Audit Log could not be written", aiAuditError);
    }

    // 7. Auto-Schedule Follow-ups based on the FINAL decision
    if (autoFollowUp) {
      let daysToAdd = 0;
      let reason = '';

      if (finalDecision === 'RED' || finalDecision === 'CRITICAL') {
        daysToAdd = 1; // Follow-up next day
        reason = 'High-risk checkup follow-up';
      } else if (finalDecision === 'YELLOW') {
        daysToAdd = 3; // Follow-up in 3 days
        reason = 'Moderate-risk checkup follow-up';
      }

      if (daysToAdd > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysToAdd);
        await AshaWorkflowRepository.scheduleFollowUp(
          visitData.patient_id, 
          dueDate.toISOString().split('T')[0], 
          reason
        );
      }
    }

    return {
      visit,
      systemRecommendation: finalSystemDecision,
      aiInsights: aiResult
    };
  }
}
