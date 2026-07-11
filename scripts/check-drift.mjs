#!/usr/bin/env node
// exports ↔ 디스크(.js/.test.js) ↔ AGENTS.md 문서 표 동기화 검사 +
// 순수 패키지 경계(상대·node: 외 import 금지) 정적 검사.
// files는 glob("*.js", "!*.test.js")이라 수동 목록 drift가 없다 — 대신 exports에 없는
// 루트 고아 .js(배포에 실리지만 소비자가 접근 못 함)를 검출한다.
// 사용: node scripts/check-drift.mjs [--no-test]
//   --no-test: AGENTS.md 테스트 수 대조(node --test 실행)를 건너뛴다.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 소스에서 외부(상대·node: 외) import specifier를 추출한다.
// 정적 import·re-export(export … from)·동적 import(표현식 위치 포함)·require 모두 검출.
// 주석·문자열 내 유사 패턴의 오탐은 fail-closed(게이트 잠금) 방향이라 허용한다.
const IMPORT_RE = /(?:^|\n)\s*import\b[^'"]*['"]([^'"]+)['"]|(?:^|\n)\s*export\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]/g;
export function scanExternalImports(src) {
  return [...src.matchAll(IMPORT_RE)]
    .map((m) => m[1] || m[2] || m[3] || m[4])
    .filter((s) => s && !s.startsWith('./') && !s.startsWith('node:'));
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');

  const problems = [];
  // exports는 { './subpath': './file.js' } — subpath와 파일명이 다를 수 있다(예: ./history → history-classifier.js).
  const entries = Object.entries(pkg.exports).map(([sub, target]) => ({
    subpath: sub,
    base: target.replace(/^\.\//, '').replace(/\.js$/, ''),
  }));

  for (const { subpath, base } of entries) {
    if (!existsSync(join(root, `${base}.js`))) problems.push(`소스 없음: ${base}.js`);
    if (!existsSync(join(root, `${base}.test.js`))) problems.push(`테스트 없음: ${base}.test.js`);
    if (!agents.includes(`### \`${subpath}\``)) problems.push(`AGENTS.md 모듈 표에 없음: ${subpath}`);
  }
  const exportBases = new Set(entries.map((e) => e.base));
  for (const f of readdirSync(root)) {
    if (f.endsWith('.js') && !f.endsWith('.test.js') && !exportBases.has(f.slice(0, -3))) {
      problems.push(`exports에 없는 고아 소스(배포에 포함됨): ${f}`);
    }
  }

  // 순수 패키지 경계 — 의존성 0 정책의 공식 게이트 (lockfile이 없어 npm audit이 불가한 것을 대신한다).
  for (const { base } of entries) {
    const specs = scanExternalImports(readFileSync(join(root, `${base}.js`), 'utf8'));
    if (specs.length) problems.push(`외부 import 발견: ${base}.js → ${specs.join(', ')}`);
  }

  if (!process.argv.includes('--no-test')) {
    const run = spawnSync('node', ['--test'], { cwd: root, encoding: 'utf8' });
    const out = `${run.stdout}\n${run.stderr}`;
    const actual = out.match(/tests (\d+)/)?.[1];
    const failed = out.match(/fail (\d+)/)?.[1];
    const documented = agents.match(/현재 (\d+)개 통과/)?.[1];
    if (!actual) problems.push('node --test 결과를 파싱하지 못함');
    else {
      if (failed && failed !== '0') problems.push(`테스트 실패 ${failed}건`);
      if (documented && documented !== actual) {
        problems.push(`AGENTS.md 테스트 수 drift: 문서 ${documented}개 vs 실제 ${actual}개`);
      }
    }
  }

  if (problems.length) {
    console.error(`✖ drift ${problems.length}건:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`✓ drift 없음 (모듈 ${entries.length}개, exports·디스크·AGENTS.md·패키지 경계 일치)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
