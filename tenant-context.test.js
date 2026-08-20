import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACADEMY_SCOPED_COLLECTIONS,
  GLOBAL_COLLECTIONS,
  col,
  colPathFor,
  collectionPath,
  docPathFor,
  docPath,
  requireAcademyId,
  resolvePathMode,
} from './tenant-context.js';

test('배치표 합계: 이동 69+payments 11+학생 진로 1, 전역 41+진로 공공자료 3, 교집합 없음', () => {
  assert.equal(ACADEMY_SCOPED_COLLECTIONS.size, 81);
  assert.equal(GLOBAL_COLLECTIONS.size, 44);
  for (const name of ACADEMY_SCOPED_COLLECTIONS) {
    assert.equal(GLOBAL_COLLECTIONS.has(name), false, name);
  }
});

test('legacy 모드는 오늘의 평면 경로 그대로 — 동작 불변의 근거', () => {
  assert.equal(collectionPath('students', { mode: 'legacy' }), 'students');
  assert.equal(collectionPath('invoices', { mode: 'legacy' }), 'invoices');
  assert.equal(docPath('students', 's1', { mode: 'legacy' }), 'students/s1');
});

test('tenant 모드는 academies/{aid}/ 경로 — 격리의 근거', () => {
  assert.equal(
    collectionPath('students', { academyId: 'impact7', mode: 'tenant' }),
    'academies/impact7/students',
  );
  assert.equal(
    docPath('invoices', 'inv1', { academyId: 'b-academy', mode: 'tenant' }),
    'academies/b-academy/invoices/inv1',
  );
  assert.equal(
    docPath('student_career_profiles', 's1', { academyId: 'impact7', mode: 'tenant' }),
    'academies/impact7/student_career_profiles/s1',
  );
});

test('전역 컬렉션은 모드와 무관하게 평면 — academyId를 주면 실패(오배치 조기 발견)', () => {
  assert.equal(collectionPath('HR_users', { mode: 'tenant' }), 'HR_users');
  assert.equal(collectionPath('exams', { mode: 'legacy' }), 'exams');
  assert.equal(collectionPath('career_jobs', { mode: 'tenant' }), 'career_jobs');
  assert.equal(collectionPath('career_majors', { mode: 'tenant' }), 'career_majors');
  assert.equal(collectionPath('universities', { mode: 'tenant' }), 'universities');
  assert.throws(() => collectionPath('HR_users', { academyId: 'impact7', mode: 'tenant' }), TypeError);
});

test('미등록 컬렉션·tenant 모드의 aid 누락·잘못된 모드는 즉시 실패', () => {
  assert.throws(() => collectionPath('typo_students', { mode: 'legacy' }), TypeError);
  assert.throws(() => collectionPath('students', { mode: 'tenant' }), TypeError);
  assert.throws(() => collectionPath('students', {}), TypeError);
  assert.throws(() => docPath('students', '', { mode: 'legacy' }), TypeError);
});

test('requireAcademyId: 클레임 객체·문자열 허용, 형식 밖은 실패', () => {
  assert.equal(requireAcademyId('impact7'), 'impact7');
  assert.equal(requireAcademyId({ academyId: 'b-academy' }), 'b-academy');
  for (const invalid of [undefined, {}, { academyId: '' }, { academyId: 'IMPACT7' }, { academyId: 'a/b' }, { academyId: '-lead' }]) {
    assert.throws(() => requireAcademyId(invalid), TypeError);
  }
});

test('resolvePathMode: 정확히 tenant일 때만 전환, 그 외 legacy 안전 기본값', () => {
  assert.equal(resolvePathMode({ TENANT_PATHS: 'tenant' }), 'tenant');
  assert.equal(resolvePathMode({ VITE_TENANT_PATHS: 'tenant' }), 'tenant');
  assert.equal(resolvePathMode({ TENANT_PATHS: 'true' }), 'legacy');
  assert.equal(resolvePathMode({}), 'legacy');
  assert.equal(resolvePathMode(undefined), 'legacy');
});

test('col: legacy는 평면, tenant는 스코프만 aid 접두·전역은 평면, 미등록은 실패', () => {
  const fakeDb = { collection: (path) => ({ path }) };
  assert.equal(col(fakeDb, 'students', {}).path, 'students');
  assert.equal(
    col(fakeDb, 'students', { TENANT_PATHS: 'tenant', ACADEMY_ID: 'acme' }).path,
    'academies/acme/students',
  );
  assert.equal(col(fakeDb, 'students', { TENANT_PATHS: 'tenant' }).path, 'academies/impact7/students');
  assert.equal(col(fakeDb, 'staff', { TENANT_PATHS: 'tenant' }).path, 'staff');
  assert.throws(() => col(fakeDb, 'no_such_collection', {}), TypeError);
  assert.throws(() => col(fakeDb, 'no_such_collection', { TENANT_PATHS: 'tenant' }), TypeError);
});

test('colPathFor/docPathFor: 클라 헬퍼 — legacy 평면, tenant 스코프만 aid 접두·전역 평면, aid 부재 fail-fast', () => {
  assert.equal(colPathFor('students', {}, undefined), 'students');
  assert.equal(colPathFor('students', { VITE_TENANT_PATHS: 'tenant' }, 'acme'), 'academies/acme/students');
  assert.equal(colPathFor('HR_users', { VITE_TENANT_PATHS: 'tenant' }, 'acme'), 'HR_users');
  assert.throws(() => colPathFor('students', { VITE_TENANT_PATHS: 'tenant' }, undefined), TypeError);
  assert.equal(docPathFor('students', 's1', {}, undefined), 'students/s1');
  assert.throws(() => docPathFor('students', '', {}, undefined), TypeError);
});
