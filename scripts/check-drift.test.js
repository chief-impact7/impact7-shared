import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanExternalImports } from './check-drift.mjs';

// 게이트의 검출 regex가 조용히 죽지 않도록 고정 — 2026-07-05 적대적 검증에서 발견된 우회 2종 포함.
test('scanExternalImports: 정적 import·require·멀티라인 검출', () => {
  assert.deepEqual(scanExternalImports(`import _ from 'lodash';`), ['lodash']);
  assert.deepEqual(scanExternalImports(`import 'side-effect-pkg';`), ['side-effect-pkg']);
  assert.deepEqual(scanExternalImports(`import {\n  a,\n  b,\n} from 'multi-line';`), ['multi-line']);
  assert.deepEqual(scanExternalImports(`const x = require('left-pad');`), ['left-pad']);
  assert.deepEqual(scanExternalImports(`import fs from 'fs';`), ['fs']); // node: 접두사 없는 builtin도 외부 취급
});

test('scanExternalImports: re-export·표현식 위치 동적 import 검출 (fail-open 우회 차단)', () => {
  assert.deepEqual(scanExternalImports(`export * from 'lodash';`), ['lodash']);
  assert.deepEqual(scanExternalImports(`export { debounce } from 'underscore';`), ['underscore']);
  assert.deepEqual(scanExternalImports(`export const load = async () => (await import('axios')).default;`), ['axios']);
  assert.deepEqual(scanExternalImports(`const lazy = () => import('moment');`), ['moment']);
});

test('scanExternalImports: 상대·node: import는 통과', () => {
  const src = [
    `import { esc } from './html-escape.js';`,
    `export { a } from './other.js';`,
    `import { readFileSync } from 'node:fs';`,
    `const m = await import('./dyn.js');`,
  ].join('\n');
  assert.deepEqual(scanExternalImports(src), []);
});

test('scanExternalImports: import 접두 단어(important 등)는 오탐하지 않음', () => {
  assert.deepEqual(scanExternalImports(`important('x');`), []);
  assert.deepEqual(scanExternalImports(`const exporter = from('y');`), []);
});
