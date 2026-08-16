import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeTeacherEmails,
  isEmployedTeacher,
  isSameTeacher,
  isTeacher,
  isTeacherStaffIdentity,
  teacherKeyOfStaff,
  teacherDisplayName,
} from './teacher-label.js';

const T = '2026-07-17';

test('강사 조건은 재직 상태와 무관하게 교수부만 포함한다', () => {
  assert.equal(isTeacher({ department: '교수', status: 'active' }), true);
  assert.equal(isTeacher({ department: '교수', status: 'terminated' }), true);
  assert.equal(isTeacher({ department: '행정', status: 'active' }), false);
  assert.equal(isTeacher(null), false);
  assert.equal(isTeacher(undefined), false);
});

test('재직 강사 조건은 교수부 재직자만 포함한다', () => {
  assert.equal(isEmployedTeacher({ department: '교수', status: 'active' }, T), true);
  assert.equal(isEmployedTeacher({ department: '행정', status: 'active' }, T), false);
  assert.equal(isEmployedTeacher({ department: '교수', status: 'terminated' }, T), false);
  assert.equal(isEmployedTeacher(null, T), false);
  assert.equal(isEmployedTeacher(undefined, T), false);
});

test('재직은 저장 status가 아닌 파생으로 판정한다', () => {
  // 저장 active + 지난 퇴사일 → 담임 후보 제외
  assert.equal(
    isEmployedTeacher({ department: '교수', status: 'active', resignationDate: '2026-01-01' }, T),
    false
  );
  // 저장 inactive + 복직일 경과 → 담임 후보 포함
  assert.equal(
    isEmployedTeacher(
      { department: '교수', status: 'inactive', leaveDate: '2026-01-01', returnDate: '2026-03-01' },
      T
    ),
    true
  );
  // 종무일 당일까지는 재직
  assert.equal(
    isEmployedTeacher({ department: '교수', status: 'active', lastWorkDate: T }, T),
    true
  );
});

test('폐기 용어 leave_pending(휴직 날짜 없음)은 재직으로 정규화되어 담임 후보', () => {
  assert.equal(isEmployedTeacher({ department: '교수', status: 'leave_pending' }, T), true);
  // leaveDate가 있으면 파생이 휴직으로 전이되어 제외
  assert.equal(
    isEmployedTeacher({ department: '교수', status: 'leave_pending', leaveDate: '2026-01-01' }, T),
    false
  );
});

test('Preferred Name 첫 토큰, 첫 글자만 대문자', () => {
  assert.equal(teacherDisplayName('Edward Lee'), 'Edward');
  assert.equal(teacherDisplayName('KEN LEE'), 'Ken');
  assert.equal(teacherDisplayName('nami lee'), 'Nami');
  assert.equal(teacherDisplayName('Rachel'), 'Rachel');
  assert.equal(teacherDisplayName('Edward   Lee'), 'Edward');
});

test('isSameTeacher — 구·신 메일은 같은 사람, 다른 로컬파트는 다른 사람', () => {
  assert.equal(isSameTeacher('edward@gw.impact7.kr', 'edward@impact7.kr'), true);
  assert.equal(isSameTeacher('Edward@impact7.kr', 'edward@impact7.kr'), true);
  assert.equal(isSameTeacher('edward@impact7.kr', 'iris@impact7.kr'), false);
  assert.equal(isSameTeacher('', 'edward@impact7.kr'), false);
  assert.equal(isSameTeacher(null, 'edward@impact7.kr'), false);
});

test('Preferred Name을 바꿔도 담당 계정 식별자는 바뀌지 않는다', () => {
  assert.equal(
    teacherKeyOfStaff({ preferredName: 'Alice', academyAccountId: 'owner' }),
    'owner'
  );
  assert.equal(
    isTeacherStaffIdentity(
      { preferredName: 'Alice', academyAccountId: 'ken', email: 'rheems22@naver.com' },
      'ken@impact7.kr'
    ),
    true
  );
  assert.equal(
    isTeacherStaffIdentity(
      { preferredName: 'Lena', email: 'lena@impact7.kr' },
      'lena@impact7.kr'
    ),
    true
  );
});

test('구·신 메일 중복은 신메일(@impact7.kr) 우선으로 사람당 1건', () => {
  assert.deepEqual(
    canonicalizeTeacherEmails(['edward@gw.impact7.kr', 'edward@impact7.kr', 'iris@gw.impact7.kr']),
    ['edward@impact7.kr', 'iris@gw.impact7.kr']
  );
  // 순서 무관하게 신메일로 수렴, 첫 등장 순서 보존
  assert.deepEqual(
    canonicalizeTeacherEmails(['ken@impact7.kr', 'ken@gw.impact7.kr']),
    ['ken@impact7.kr']
  );
});

test('canonicalizeTeacherEmails — 빈값·비문자열·null 입력 안전', () => {
  assert.deepEqual(canonicalizeTeacherEmails([]), []);
  assert.deepEqual(canonicalizeTeacherEmails(null), []);
  assert.deepEqual(canonicalizeTeacherEmails(['', null, 42, 'sr@impact7.kr']), ['sr@impact7.kr']);
});

test('공백·빈값·비문자열은 빈 문자열', () => {
  assert.equal(teacherDisplayName('  Sierra  '), 'Sierra');
  assert.equal(teacherDisplayName(''), '');
  assert.equal(teacherDisplayName('   '), '');
  assert.equal(teacherDisplayName(null), '');
  assert.equal(teacherDisplayName(42), '');
});

// ─── 2026-07-05 리뷰 P6 회귀 ───
test('isSameTeacher: 외부 도메인의 같은 로컬파트는 다른 사람', () => {
  assert.equal(isSameTeacher('edward@gmail.com', 'edward@impact7.kr'), false);
  assert.equal(isSameTeacher('edward@gmail.com', 'edward@gmail.com'), true); // 같은 외부 도메인은 동일
  assert.equal(isSameTeacher('edward@gw.impact7.kr', 'edward@impact7.kr'), true); // 구·신 내부 유지
  assert.equal(isSameTeacher('edward', 'edward@impact7.kr'), true); // 도메인 없는 ID 허용 유지
});

test('canonicalizeTeacherEmails: 외부 도메인은 내부와 병합하지 않음', () => {
  assert.deepEqual(
    canonicalizeTeacherEmails(['edward@gw.impact7.kr', 'edward@gmail.com', 'edward@impact7.kr']),
    ['edward@impact7.kr', 'edward@gmail.com']
  );
});

test('강사 식별은 사용자 지정 주·레거시 도메인을 같은 사람으로 병합한다', () => {
  const config = {
    brandName: '샘플 학원',
    primaryStaffDomain: 'sample.edu',
    legacyStaffDomains: ['old.sample.edu'],
    formContact: { channelLabel: '채널 문의', channelUrl: 'https://sample.edu/channel', inquiryLabel: '상담 문의', inquiryUrl: 'https://sample.edu/contact' },
  };
  assert.equal(isSameTeacher('edward@old.sample.edu', 'edward@sample.edu', config), true);
  assert.equal(isSameTeacher('edward@impact7.kr', 'edward@sample.edu', config), false);
  assert.equal(
    isTeacherStaffIdentity({ email: 'edward@old.sample.edu' }, 'edward@sample.edu', config),
    true
  );
  assert.deepEqual(
    canonicalizeTeacherEmails(['edward@old.sample.edu', 'edward@sample.edu'], config),
    ['edward@sample.edu']
  );
});
