from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Arogyadisha AI Decision Support Service")

class VisitContext(BaseModel):
    vitals: dict
    symptoms: List[str]
    rule_engine_severity: str

class AIRecommendation(BaseModel):
    recommendation: str # 'GREEN', 'YELLOW', 'RED', 'CRITICAL'
    reason: str
    key_observations: List[str]
    suggested_next_step: str

@app.post("/api/v1/recommendation", response_model=AIRecommendation)
def get_recommendation(context: VisitContext):
    """
    Evaluates clinical context. This AI Service cannot make final decisions 
    or downgrade safety rules. It only provides recommendations.
    """
    # Mock AI Logic for demonstration
    recommendation = "GREEN"
    reason = "Patient appears stable based on AI heuristic analysis."
    key_obs = []
    
    if context.vitals.get("temperature", 98) > 100 or "fever" in context.symptoms:
        recommendation = "YELLOW"
        reason = "Elevated temperature detected."
        key_obs.append("Fever")
        
    if "chest_pain" in context.symptoms:
        recommendation = "CRITICAL"
        reason = "Chest pain is a critical danger sign requiring immediate review."
        key_obs.append("Chest Pain")

    return AIRecommendation(
        recommendation=recommendation,
        reason=reason,
        key_observations=key_obs,
        suggested_next_step="Continue with standard protocols." if recommendation == "GREEN" else "Consult Doctor immediately."
    )

# Run instructions: uvicorn main:app --host 0.0.0.0 --port 8000
