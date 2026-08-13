export type AiModelPolicyFeature =
  | 'parent-message'
  | 'consultation-title'
  | 'exam-general-text'
  | 'growth-commentary'
  | 'board-briefing'
  | 'survey-analysis'
  | 'student-report';

export const GEMINI_FLASH_PRIMARY: 'gemini-3.6-flash';
export const GEMINI_FLASH_FALLBACK: 'gemini-3.5-flash';
export const GEMINI_FLASH_LITE: 'gemini-3.5-flash-lite';

export function aiModelSequence(feature: AiModelPolicyFeature): readonly string[];

export function runWithAiModelPolicy<T>(
  feature: AiModelPolicyFeature,
  generate: (model: string, index: number) => Promise<T>,
): Promise<T>;

export function geminiGenerationConfig<T extends Record<string, unknown>>(
  model: string,
  config?: T,
): (T | Omit<T, 'temperature' | 'topP' | 'topK' | 'top_p' | 'top_k'>) & {
  thinkingConfig?: { thinkingLevel: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' };
};
