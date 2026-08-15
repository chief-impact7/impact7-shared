import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  GEMINI_FLASH_FALLBACK,
  GEMINI_FLASH_LITE,
  GEMINI_FLASH_PRIMARY,
  aiModelSequence,
  geminiGenerationConfig,
  runWithAiModelPolicy,
} from './ai-model-policy.js';

const LITE_PRIMARY_SEQUENCE = [GEMINI_FLASH_LITE, GEMINI_FLASH_PRIMARY];
const PRIMARY_FALLBACK_SEQUENCE = [GEMINI_FLASH_PRIMARY, GEMINI_FLASH_FALLBACK];

test('공개 Gemini Flash 모델 상수를 고정', () => {
  assert.equal(GEMINI_FLASH_PRIMARY, 'gemini-3.7-flash');
  assert.equal(GEMINI_FLASH_FALLBACK, 'gemini-3.6-flash');
  assert.equal(GEMINI_FLASH_LITE, 'gemini-3.5-flash-lite');
});

test('기능별 기본 모델과 폴백을 한 곳에서 결정', () => {
  for (const feature of ['parent-message', 'consultation-title', 'growth-commentary']) {
    assert.deepEqual(aiModelSequence(feature), LITE_PRIMARY_SEQUENCE);
  }
  for (const feature of ['exam-general-text', 'student-report', 'board-briefing', 'survey-analysis']) {
    assert.deepEqual(aiModelSequence(feature), PRIMARY_FALLBACK_SEQUENCE);
  }
});

test('학부모 총평은 Lite 실패 시 3.7로 폴백', async () => {
  const called = [];
  const result = await runWithAiModelPolicy('parent-message', async (model, index) => {
    called.push([model, index]);
    if (model === GEMINI_FLASH_LITE) throw new Error('primary failed');
    return 'fallback result';
  });
  assert.equal(result, 'fallback result');
  assert.deepEqual(called, [
    [GEMINI_FLASH_LITE, 0],
    [GEMINI_FLASH_PRIMARY, 1],
  ]);
});

test('상담 제목은 Lite 실패 시 3.7로 폴백', async () => {
  const called = [];
  const result = await runWithAiModelPolicy('consultation-title', async (model) => {
    called.push(model);
    if (model === GEMINI_FLASH_LITE) throw new Error('invalid title');
    return '정상 제목';
  });
  assert.equal(result, '정상 제목');
  assert.deepEqual(called, [GEMINI_FLASH_LITE, GEMINI_FLASH_PRIMARY]);
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

test('모델별 기본 사고 수준을 적용하고 명시값을 보존', () => {
  assert.deepEqual(
    geminiGenerationConfig(GEMINI_FLASH_PRIMARY, {
      temperature: 0.4,
      topP: 0.9,
      topK: 20,
      maxOutputTokens: 1024,
    }),
    { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'LOW' } },
  );
  assert.deepEqual(
    geminiGenerationConfig(GEMINI_FLASH_LITE, { maxOutputTokens: 256 }),
    { maxOutputTokens: 256, thinkingConfig: { thinkingLevel: 'MINIMAL' } },
  );
  assert.deepEqual(
    geminiGenerationConfig(GEMINI_FLASH_PRIMARY, {
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingLevel: 'MEDIUM' },
    }),
    { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'MEDIUM' } },
  );
  assert.deepEqual(
    geminiGenerationConfig(GEMINI_FLASH_FALLBACK, {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1024,
    }),
    { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'LOW' } },
  );
});
