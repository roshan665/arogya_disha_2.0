-- Phase 5: Safety Rule Engine & AI Audit
-- 20260904000002_safety_engine.sql

-- ==========================================
-- 1. SAFETY RULE ENGINE TABLES
-- ==========================================

CREATE TABLE safety_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL, -- Logical grouping ID for versions
    version INT NOT NULL,
    conditions JSONB NOT NULL,
    severity risk_level NOT NULL,
    action TEXT NOT NULL,
    explanation TEXT NOT NULL,
    effective_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES profiles(id),
    UNIQUE(rule_id, version)
);

CREATE INDEX idx_safety_rules_effective ON safety_rules(effective_date);

-- ==========================================
-- 2. AI AUDIT LOGS
-- ==========================================

CREATE TABLE ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID REFERENCES asha_visits(id) ON DELETE CASCADE,
    rule_version_snapshot JSONB NOT NULL, -- Which rules fired
    ai_model_version TEXT NOT NULL,
    input_snapshot JSONB NOT NULL, -- Context given to AI
    ai_recommendation risk_level,
    ai_reason TEXT,
    rule_recommendation risk_level NOT NULL,
    final_decision risk_level NOT NULL,
    is_overridden BOOLEAN DEFAULT false NOT NULL,
    override_reason TEXT,
    actor_id UUID NOT NULL REFERENCES profiles(id),
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_ai_audit_logs_visit ON ai_audit_logs(visit_id);

-- Prevent Updates and Deletes on AI Audit Logs
CREATE RULE prevent_ai_audit_log_update AS ON UPDATE TO ai_audit_logs DO INSTEAD NOTHING;
CREATE RULE prevent_ai_audit_log_delete AS ON DELETE TO ai_audit_logs DO INSTEAD NOTHING;

-- Enable RLS
ALTER TABLE safety_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rules viewable by all authorized staff" ON safety_rules FOR SELECT USING (true);
CREATE POLICY "Rules editable by System Admin" ON safety_rules FOR ALL USING (public.has_role('SYSTEM_ADMIN'::user_role));

CREATE POLICY "AI Audit logs insertable by anyone" ON ai_audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "AI Audit logs viewable only by System Admin" ON ai_audit_logs FOR SELECT USING (public.has_role('SYSTEM_ADMIN'::user_role));
