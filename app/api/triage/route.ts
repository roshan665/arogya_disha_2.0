import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

// Lazy initialization of GoogleGenAI client on server
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface TriageRequestBody {
  patient_name?: string;
  age?: number;
  gender?: string;
  symptoms: string[] | string;
  vitals?: {
    bp?: string;
    bp_systolic?: number;
    bp_diastolic?: number;
    spo2?: number;
    heart_rate?: number;
    temperature?: number;
    respiratory_rate?: number;
    blood_sugar?: number;
    [key: string]: any;
  };
  additional_notes?: string;
}

export interface TriageResponseData {
  risk_score: 'GREEN' | 'YELLOW' | 'RED';
  ai_summary: string;
  recommended_action: string;
  marathi_translation: string;
  hindi_translation?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: TriageRequestBody = await req.json();

    if (!body || (!body.symptoms && !body.vitals)) {
      return NextResponse.json(
        { error: 'Invalid input. Please provide patient symptoms and/or vitals for clinical triage.' },
        { status: 400 }
      );
    }

    const symptomsList = Array.isArray(body.symptoms)
      ? body.symptoms.join(', ')
      : body.symptoms || 'None specified';

    const vitalsFormatted = body.vitals
      ? Object.entries(body.vitals)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : 'No vitals recorded';

    const prompt = `You are a clinical decision support system for primary healthcare workers (ASHA/ANM) in rural India under the ArogyaDisha initiative.
Evaluate the patient case below and provide a structured clinical risk triage.

PATIENT INFORMATION:
- Name: ${body.patient_name || 'Anonymous'}
- Age: ${body.age ? `${body.age} yrs` : 'Not recorded'}
- Gender: ${body.gender || 'Not specified'}

REPORTED SYMPTOMS:
${symptomsList}

RECORDED VITALS & LABS:
${vitalsFormatted}

ADDITIONAL FIELD NOTES:
${body.additional_notes || 'None'}

CLINICAL GUIDELINES:
- RED (High Risk / Critical Emergency): Signs of shock, SpO2 < 90%, hypertensive crisis (BP > 180/110), severe respiratory distress, acute chest pain, altered consciousness, post-partum hemorrhage, sepsis. Immediate emergency stabilization and 108 ambulance referral required.
- YELLOW (Moderate Risk / Urgent Follow-up): Persistent fever > 3 days, mild hypoxia (SpO2 90-94%), stage 1/2 hypertension, suspected infectious disease, maternal anemia, elderly comorbidities requiring PHC Medical Officer review within 24-48 hours.
- GREEN (Low Risk / Routine Community Care): Mild seasonal coryza, stable chronic vitals, routine immunization, standard nutritional counseling, manageable domiciliary care.

OUTPUT REQUIREMENTS:
Provide a strictly valid JSON response conforming to the schema:
- risk_score: Exactly "GREEN", "YELLOW", or "RED".
- ai_summary: Concise 2-3 sentence clinical summary in English explaining key physiological findings.
- recommended_action: Actionable steps for the frontline ASHA/ANM worker (e.g. oxygen administration, teleconsult with MO, 108 referral, paracetamol dosage).
- marathi_translation: An accurate, respectful Marathi translation (मराठी भाषांतर) of the recommended action and risk summary.
- hindi_translation: An accurate, respectful Hindi translation (हिंदी अनुवाद) of the recommended action and risk summary.`;

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are ArogyaDisha Clinical AI, an evidence-based rural triage assistant supporting Indian Primary Health Centers and ASHA workers. Always deliver precise, safe clinical evaluations.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_score: {
              type: Type.STRING,
              description: 'Triage risk category: strictly GREEN, YELLOW, or RED',
              enum: ['GREEN', 'YELLOW', 'RED'],
            },
            ai_summary: {
              type: Type.STRING,
              description: 'Concise clinical summary in English',
            },
            recommended_action: {
              type: Type.STRING,
              description: 'Actionable clinical recommendation for the health worker',
            },
            marathi_translation: {
              type: Type.STRING,
              description: 'Accurate Marathi translation of summary and action plan',
            },
            hindi_translation: {
              type: Type.STRING,
              description: 'Accurate Hindi translation of summary and action plan',
            },
          },
          required: ['risk_score', 'ai_summary', 'recommended_action', 'marathi_translation', 'hindi_translation'],
        },
      },
    });

    const responseText = response.text?.trim() || '{}';
    const parsedData: TriageResponseData = JSON.parse(responseText);

    // Validate risk_score enum
    if (!['GREEN', 'YELLOW', 'RED'].includes(parsedData.risk_score)) {
      parsedData.risk_score = 'YELLOW';
    }

    return NextResponse.json(parsedData, { status: 200 });
  } catch (error: any) {
    console.error('ArogyaDisha Triage API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process clinical triage request',
        details: error?.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
