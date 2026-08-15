export const GEMINI_FLASH_PRIMARY = 'gemini-3.7-flash';
export const GEMINI_FLASH_FALLBACK = 'gemini-3.6-flash';
export const GEMINI_FLASH_LITE = 'gemini-3.5-flash-lite';

const AI_MODEL_POLICIES = Object.freeze({
  'parent-message': Object.freeze([GEMINI_FLASH_LITE, GEMINI_FLASH_PRIMARY]),
  'consultation-title': Object.freeze([GEMINI_FLASH_LITE, GEMINI_FLASH_PRIMARY]),
  'exam-general-text': Object.freeze([GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK]),
  'growth-commentary': Object.freeze([GEMINI_FLASH_LITE, GEMINI_FLASH_PRIMARY]),
  'student-report': Object.freeze([GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK]),
  'board-briefing': Object.freeze([GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK]),
  'survey-analysis': Object.freeze([GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK]),
});

export function aiModelSequence(feature) {
  const models = AI_MODEL_POLICIES[feature];
  if (!models) throw new Error(`Unknown AI model policy: ${feature}`);
  return models;
}

export async function runWithAiModelPolicy(feature, generate) {
  let firstError;
  let lastError;
  for (const [index, model] of aiModelSequence(feature).entries()) {
    try {
      return await generate(model, index);
    } catch (error) {
      firstError ??= error;
      lastError = error;
    }
  }
  if (lastError instanceof Error && lastError.cause == null && lastError !== firstError) {
    lastError.cause = firstError;
  }
  throw lastError;
}

export function geminiGenerationConfig(model, config = {}) {
  const usesLowThinking = model === GEMINI_FLASH_PRIMARY || model === GEMINI_FLASH_FALLBACK;
  let normalized = config;
  if (usesLowThinking) {
    const { temperature, topP, topK, top_p, top_k, ...supported } = config;
    normalized = supported;
  }
  if (normalized.thinkingConfig) return normalized;
  if (model === GEMINI_FLASH_LITE) {
    return { ...normalized, thinkingConfig: { thinkingLevel: 'MINIMAL' } };
  }
  if (usesLowThinking) {
    return { ...normalized, thinkingConfig: { thinkingLevel: 'LOW' } };
  }
  return normalized;
}
