import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  GEMINI_FLASH_FALLBACK,
  GEMINI_FLASH_PRIMARY,
  aiModelSequence,
  geminiGenerationConfig,
  runWithAiModelPolicy,
} from './ai-model-policy.js';

test('기능별 3.6 기본 모델과 지정된 3.5 폴백을 한 곳에서 결정', () => {
  assert.deepEqual(aiModelSequence('parent-message'), [GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK]);
  assert.deepEqual(aiModelSequence('consultation-title'), [GEMINI_FLASH_PRIMARY]);
  assert.deepEqual(aiModelSequence('exam-general-text'), [GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK]);
  assert.deepEqual(aiModelSequence('student-report'), [GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK]);
});

test('학부모 총평은 3.6 실패 시 3.5로 폴백', async () => {
  const called = [];
  const result = await runWithAiModelPolicy('parent-message', async (model, index) => {
    called.push([model, index]);
    if (model === GEMINI_FLASH_PRIMARY) throw new Error('primary failed');
    return 'fallback result';
  });
  assert.equal(result, 'fallback result');
  assert.deepEqual(called, [
    [GEMINI_FLASH_PRIMARY, 0],
    [GEMINI_FLASH_FALLBACK, 1],
  ]);
});

test('상담 제목은 3.6 실패 시 다른 모델을 호출하지 않음', async () => {
  const called = [];
  await assert.rejects(
    runWithAiModelPolicy('consultation-title', async (model) => {
      called.push(model);
      throw new Error('failed');
    }),
    /failed/,
  );
  assert.deepEqual(called, [GEMINI_FLASH_PRIMARY]);
});

test('폴백도 실패하면 마지막 오류에 최초 오류를 보존', async () => {
  const primaryError = new Error('primary failed');
  const fallbackError = new Error('fallback failed');
  await assert.rejects(
    runWithAiModelPolicy('exam-general-text', async (model) => {
      throw model === GEMINI_FLASH_PRIMARY ? primaryError : fallbackError;
    }),
    (error) => error === fallbackError && error.cause === primaryError,
  );
});

test('3.6 요청에서 폐기된 sampling 파라미터만 제거', () => {
  assert.deepEqual(
    geminiGenerationConfig(GEMINI_FLASH_PRIMARY, {
      temperature: 0.4,
      topP: 0.9,
      topK: 20,
      maxOutputTokens: 1024,
    }),
    { maxOutputTokens: 1024 },
  );
  const fallbackConfig = { temperature: 0.4, maxOutputTokens: 1024 };
  assert.equal(geminiGenerationConfig(GEMINI_FLASH_FALLBACK, fallbackConfig), fallbackConfig);
});
