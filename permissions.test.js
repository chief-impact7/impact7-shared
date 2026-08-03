import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
  canCreateLeaveRequest,
  canEditLeaveRequest,
  SENSITIVE_PERMISSION_KEYS,
} from './permissions.js';

const VALID_ENFORCED = new Set(['rules', 'client', 'none']);

test('키 중복 없음', () => {
  const seen = new Set();
  for (const key of ALL_PERMISSION_KEYS) {
    assert.ok(!seen.has(key), `중복 키: ${key}`);
    seen.add(key);
  }
  assert.equal(seen.size, ALL_PERMISSION_KEYS.length);
});

test('ALL_PERMISSION_KEYS 개수 51', () => {
  assert.equal(ALL_PERMISSION_KEYS.length, 51);
});

test('모든 item에 key/label/apps/enforced 존재', () => {
  const assertItems = (items, groupKey) => {
    for (const item of items) {
      assert.equal(typeof item.label, 'string', `label 누락: ${groupKey}`);
      assert.ok(item.label.length > 0, `빈 label: ${groupKey}`);
      if ('children' in item) {
        assert.equal(typeof item.id, 'string', `id 누락: ${groupKey}/${item.label}`);
        assert.ok(Array.isArray(item.children), `children 오류: ${groupKey}/${item.label}`);
        assertItems(item.children, `${groupKey}/${item.id}`);
        continue;
      }
      assert.equal(typeof item.key, 'string', `key 누락: ${groupKey}`);
      assert.ok(item.key.length > 0, `빈 key: ${groupKey}`);
      assert.ok(Array.isArray(item.apps) && item.apps.length > 0, `apps 누락: ${item.key}`);
      assert.ok(item.apps.every((a) => typeof a === 'string' && a.length > 0), `apps 원소 오류: ${item.key}`);
      assert.equal(typeof item.enforced, 'string', `enforced 누락: ${item.key}`);
    }
  };

  for (const group of PERMISSION_GROUPS) {
    assert.equal(typeof group.key, 'string');
    assert.equal(typeof group.title, 'string');
    assert.ok(Array.isArray(group.items) && group.items.length > 0, `빈 그룹: ${group.key}`);
    assertItems(group.items, group.key);
  }
});

test('enforced 값은 rules/client/none 3종만', () => {
  const assertItems = (items) => {
    for (const item of items) {
      if ('children' in item) {
        assertItems(item.children);
      } else {
        assert.ok(VALID_ENFORCED.has(item.enforced), `잘못된 enforced: ${item.key}=${item.enforced}`);
      }
    }
  };

  for (const group of PERMISSION_GROUPS) {
    assertItems(group.items);
  }
});

test('인사 그룹은 온보딩·계약서와 부서별 급여약정서 권한을 제공한다', () => {
  const hr = PERMISSION_GROUPS.find((group) => group.key === 'hr');
  assert.ok(hr);
  assert.equal(hr.title, '인사');
  assert.deepEqual(
    hr.items.filter((item) => !('children' in item)).slice(0, 2).map((item) => [item.key, item.label]),
    [
      ['canManageOnboarding', '온보딩'],
      ['canManageContracts', '계약서'],
    ],
  );
  assert.deepEqual(
    hr.items.filter((item) => 'children' in item).map((item) => [item.id, item.label, item.children]),
    [
      ['salary-agreement', '급여약정서', [
        { key: 'canManageAdministrationSalaryAgreements', label: '행정', apps: ['HR'], enforced: 'rules' },
        { key: 'canManageFacultySalaryAgreements', label: '교수', apps: ['HR'], enforced: 'rules' },
      ]],
    ],
  );
});

test('요청서 그룹은 작성·대리작성·부서별 승인·변경 권한을 제공한다', () => {
  const requests = PERMISSION_GROUPS.find((group) => group.key === 'requests');

  assert.deepEqual(requests, {
    key: 'requests',
    title: '요청서',
    items: [
      { key: 'canCreateLeaveRequests', label: '요청서작성', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canCreateLeaveRequestsOnBehalf', label: '요청서대리작성', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canApproveFacultyLeaveRequests', label: '교수부승인', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canApproveAdministrationLeaveRequests', label: '행정부승인', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canEditLeaveRequests', label: '요청서변경', apps: ['DB', 'DSC'], enforced: 'rules' },
      { key: 'canEditLeaveRequestsOnBehalf', label: '요청서대리변경', apps: ['DB', 'DSC'], enforced: 'rules' },
    ],
  });
});

test('요청서 작성은 작성 또는 대리작성 권한으로 허용한다', () => {
  assert.equal(canCreateLeaveRequest({ permissions: { canCreateLeaveRequests: true } }), true);
  assert.equal(canCreateLeaveRequest({ permissions: { canCreateLeaveRequestsOnBehalf: true } }), true);
  assert.equal(canCreateLeaveRequest({ permissions: {} }), false);
});

test('요청서 변경은 본인과 대리 권한을 구분하고 오너는 모두 허용한다', () => {
  const editor = { permissions: { canEditLeaveRequests: true } };
  const proxy = { permissions: { canEditLeaveRequestsOnBehalf: true } };

  assert.equal(canEditLeaveRequest(editor, true), true);
  assert.equal(canEditLeaveRequest(editor, false), false);
  assert.equal(canEditLeaveRequest(proxy, false), true);
  assert.equal(canEditLeaveRequest({ role: 'owner', permissions: {} }, false), true);
});

test('중첩 item의 권한 키도 ALL_PERMISSION_KEYS에 포함된다', () => {
  const collectKeys = (items) => items.flatMap((item) => (
    'children' in item ? collectKeys(item.children) : [item.key]
  ));

  assert.deepEqual(
    ALL_PERMISSION_KEYS,
    PERMISSION_GROUPS.flatMap((group) => collectKeys(group.items)),
  );
});

test('SENSITIVE_PERMISSION_KEYS ⊆ ALL_PERMISSION_KEYS', () => {
  const all = new Set(ALL_PERMISSION_KEYS);
  for (const key of SENSITIVE_PERMISSION_KEYS) {
    assert.ok(all.has(key), `SENSITIVE 키가 카탈로그에 없음: ${key}`);
  }
});

test('그룹 key 중복 없음', () => {
  const keys = PERMISSION_GROUPS.map((g) => g.key);
  assert.equal(new Set(keys).size, keys.length);
});
