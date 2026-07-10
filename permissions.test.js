import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
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

test('ALL_PERMISSION_KEYS 개수 43', () => {
  assert.equal(ALL_PERMISSION_KEYS.length, 43);
});

test('모든 item에 key/label/apps/enforced 존재', () => {
  for (const group of PERMISSION_GROUPS) {
    assert.equal(typeof group.key, 'string');
    assert.equal(typeof group.title, 'string');
    assert.ok(Array.isArray(group.items) && group.items.length > 0, `빈 그룹: ${group.key}`);
    for (const item of group.items) {
      assert.equal(typeof item.key, 'string', `key 누락: ${group.key}`);
      assert.ok(item.key.length > 0, `빈 key: ${group.key}`);
      assert.equal(typeof item.label, 'string', `label 누락: ${item.key}`);
      assert.ok(item.label.length > 0, `빈 label: ${item.key}`);
      assert.ok(Array.isArray(item.apps) && item.apps.length > 0, `apps 누락: ${item.key}`);
      assert.ok(item.apps.every((a) => typeof a === 'string' && a.length > 0), `apps 원소 오류: ${item.key}`);
      assert.equal(typeof item.enforced, 'string', `enforced 누락: ${item.key}`);
    }
  }
});

test('enforced 값은 rules/client/none 3종만', () => {
  for (const group of PERMISSION_GROUPS) {
    for (const item of group.items) {
      assert.ok(VALID_ENFORCED.has(item.enforced), `잘못된 enforced: ${item.key}=${item.enforced}`);
    }
  }
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
