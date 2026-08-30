import test from 'node:test';
import assert from 'node:assert/strict';

test('신청 종류를 식별자로 조회한다', async () => {
  const { applicationKind } = await import('./application-kinds.js');

  assert.equal(applicationKind('diagnostic')?.formSlug, 'diagnostic-application');
  assert.equal(applicationKind('inquiry')?.pipeline, 'inquiry');
  assert.equal(applicationKind('missing'), null);
});

test('활성 신청 종류만 등록 순서대로 반환한다', async () => {
  const { enabledApplicationKinds } = await import('./application-kinds.js');

  assert.deepEqual(enabledApplicationKinds().map(({ kind }) => kind), ['diagnostic', 'inquiry']);
});
