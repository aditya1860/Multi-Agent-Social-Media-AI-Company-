import Anthropic from '@anthropic-ai/sdk';
import { z, ZodSchema } from 'zod';
import { env } from '../config/env';

const isPlaceholderKey = !env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.includes('your-anthropic-api-key') || env.ANTHROPIC_API_KEY.length < 10;

const client = !isPlaceholderKey ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const LLM_TIMEOUT_MS = 30_000;
const LLM_RETRIES = 1;

// Generic LLM caller with timeout, retry, and JSON schema validation
export async function callLLM<T>(
  prompt: string,
  schema: ZodSchema<T>
): Promise<{ data: T | null; rawResponse: string | null; error: string | null }> {
  if (isPlaceholderKey || !client) {
    console.warn('[LLM Service] ANTHROPIC_API_KEY is not configured or is a placeholder. Using heuristic fallback engine.');
    return { data: null, rawResponse: null, error: 'LLM not configured (missing or placeholder ANTHROPIC_API_KEY)' };
  }

  console.log('[LLM Service] Initiating API request to Anthropic (claude-3-5-sonnet-20241022)...');

  let lastError: string = 'Unknown error';
  for (let attempt = 0; attempt <= LLM_RETRIES; attempt++) {
    try {
      const response = await Promise.race([
        client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
          system:
            'You are a clinical AI assistant. Always respond with valid JSON matching the requested schema. No markdown, no explanation — pure JSON only.',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM call timed out after 30 seconds')), LLM_TIMEOUT_MS)
        ),
      ]);

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log('[LLM Service] Raw Anthropic API Response received:', text);

      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const validated = schema.safeParse(parsed);

      if (!validated.success) {
        lastError = `Schema validation failed: ${validated.error.message}`;
        console.error(`[LLM Service] Attempt ${attempt + 1} validation error:`, lastError);
        continue;
      }

      console.log('[LLM Service] Successfully validated LLM JSON response.');
      return { data: validated.data, rawResponse: text, error: null };
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.error(`[LLM Service] Attempt ${attempt + 1} failed:`, lastError);
    }
  }

  return { data: null, rawResponse: null, error: lastError };
}

// Pre-visit summary schema
const PreVisitSchema = z.object({
  urgencyLevel: z.enum(['Low', 'Medium', 'High']),
  chiefComplaint: z.string(),
  suggestedQuestions: z.array(z.string()).length(3),
});
export type PreVisitResult = z.infer<typeof PreVisitSchema>;

// Rule-based heuristic fallback evaluator for symptoms
function fallbackEvaluateSymptoms(symptoms: string): PreVisitResult {
  const s = symptoms.toLowerCase();
  let urgencyLevel: 'Low' | 'Medium' | 'High' = 'Low';

  const highKeywords = ['chest pain', 'shortness of breath', 'difficulty breathing', 'severe', 'numbness', 'fainting', 'stroke', 'unconscious', 'bleeding'];
  const mediumKeywords = ['fever', 'cough', 'vomiting', 'pain', 'swelling', 'rash', 'dizziness', 'headache', 'infection', 'nausea'];

  if (highKeywords.some((k) => s.includes(k))) {
    urgencyLevel = 'High';
  } else if (mediumKeywords.some((k) => s.includes(k))) {
    urgencyLevel = 'Medium';
  }

  const chiefComplaint = `Patient reports: ${symptoms.length > 80 ? symptoms.slice(0, 80) + '...' : symptoms}`;

  const suggestedQuestions = [
    'How long have these symptoms been present and have they worsened recently?',
    'Are there any aggravating or relieving factors associated with these symptoms?',
    'Do you have any relevant past medical history or current medications?',
  ];

  return { urgencyLevel, chiefComplaint, suggestedQuestions };
}

export async function generatePreVisitSummary(symptoms: string) {
  const prompt = `Analyse these symptoms and return a JSON object with EXACTLY these fields:
- urgencyLevel: "Low", "Medium", or "High"
- chiefComplaint: string describing the main complaint in one sentence
- suggestedQuestions: array of exactly 3 questions the doctor should ask

Symptoms: ${symptoms}

Respond with valid JSON only.`;

  const result = await callLLM(prompt, PreVisitSchema);

  // If real LLM succeeds, return its result
  if (result.data) {
    return result;
  }

  // Fallback heuristic evaluation
  console.log('[LLM Service] Applying clinical heuristic fallback for symptom assessment.');
  const fallbackData = fallbackEvaluateSymptoms(symptoms);
  return {
    data: fallbackData,
    rawResponse: `[Heuristic Fallback Engine] Analyzed symptoms: "${symptoms}". Evaluated Urgency: ${fallbackData.urgencyLevel}`,
    error: result.error,
  };
}

// Post-visit summary schema
const PostVisitSchema = z.object({
  summary: z.string(),
  medicationSchedule: z.array(
    z.object({
      drug: z.string(),
      dosage: z.string(),
      timesPerDay: z.number(),
      durationDays: z.number(),
    })
  ),
  followUpSteps: z.array(z.string()),
});
export type PostVisitResult = z.infer<typeof PostVisitSchema>;

function fallbackEvaluatePostVisit(notes: string, prescription: any[]): PostVisitResult {
  const meds = (prescription || []).map((p: any) => ({
    drug: p.drug || 'Prescribed medication',
    dosage: p.dosage || 'As directed',
    timesPerDay: p.frequency?.toLowerCase().includes('twice') ? 2 : 1,
    durationDays: p.durationDays || 7,
  }));

  return {
    summary: `Summary of Visit: ${notes.slice(0, 150)}${notes.length > 150 ? '...' : ''}. Please follow the prescribed medication schedule and care instructions below.`,
    medicationSchedule: meds,
    followUpSteps: [
      'Take all prescribed medications according to schedule.',
      'Monitor your symptoms daily and rest adequately.',
      'Contact clinic or seek immediate medical care if symptoms worsen.',
    ],
  };
}

export async function generatePostVisitSummary(notes: string, prescription: any[]) {
  const prompt = `Convert these clinical notes into a patient-friendly summary. Return a JSON object with EXACTLY these fields:
- summary: string (1-2 paragraphs, plain language, no medical jargon)
- medicationSchedule: array of {drug, dosage, timesPerDay, durationDays}
- followUpSteps: array of strings describing next steps for the patient

Clinical notes: ${notes}
Prescription: ${JSON.stringify(prescription)}

Respond with valid JSON only.`;

  const result = await callLLM(prompt, PostVisitSchema);

  if (result.data) {
    return result;
  }

  console.log('[LLM Service] Applying clinical heuristic fallback for post-visit summary.');
  const fallbackData = fallbackEvaluatePostVisit(notes, prescription);
  return {
    data: fallbackData,
    rawResponse: `[Heuristic Fallback Engine] Summarized clinical notes.`,
    error: result.error,
  };
}
