import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RETENTION_BUFFER_DAYS,
  teacherOfClassAt,
  buildStudentSegments,
  churnEventsForStudent,
  attributeEvent,
  periodRange,
  aggregateRetention,
} from './retention.js';
import { groupLeaveCycles } from './leave-cycles.js';
import { todayKST } from './datetime.js';

const 길동 = 'gildong@impact7.kr';
const 길순 = 'gilsoon@impact7.kr';
const 민수 = 'minsu@impact7.kr';

// ─── teacherOfClassAt ───

const HISTORY = [
  { class_code: 'HA101', teacher: 길순, prev_teacher: 길동, changed_at: '2026-06-01T10:00:00+09:00' },
  { class_code: 'HA101', teacher: 길동, prev_teacher: 길순, changed_at: { seconds: 1781492800, nanoseconds: 0 } }, // 2026-06-15 KST
];

test('teacherOfClassAt: changed_at<=D 최신 레코드의 teacher', () => {
  assert.deepEqual(teacherOfClassAt('HA101', '2026-06-10', HISTORY, {}), { teacher: 길순, uncertain: false });
  assert.deepEqual(teacherOfClassAt('HA101', '2026-07-01', HISTORY, {}), { teacher: 길동, uncertain: false });
});

test('teacherOfClassAt: 첫 레코드 이전은 prev_teacher 추정(uncertain)', () => {
  assert.deepEqual(teacherOfClassAt('HA101', '2026-05-01', HISTORY, {}), { teacher: 길동, uncertain: true });
});

test('teacherOfClassAt: history 없으면 classSettings teacher 추정, 그것도 없으면 빈 값', () => {
  assert.deepEqual(teacherOfClassAt('HB201', '2026-05-01', HISTORY, { HB201: { teacher: 길순 } }), { teacher: 길순, uncertain: true });
  assert.deepEqual(teacherOfClassAt('HB201', '2026-05-01', [], {}), { teacher: '', uncertain: true });
});

test('teacherOfClassAt: 반코드 표기 차이(소문자)를 흡수한다', () => {
  assert.deepEqual(teacherOfClassAt('ha101', '2026-07-01', HISTORY, {}), { teacher: 길동, uncertain: false });
});

// ─── buildStudentSegments ───

const CS = {
  HA101: { teacher: 길동 },
  HB201: { teacher: 민수 },
  목동중1A: { teacher: 길순, naesin_start: '2026-03-20', naesin_end: '2026-05-06' },
};
const 학생_내신전환 = {
  enrollments: [{
    level_symbol: 'HA', class_number: '101', class_type: '정규',
    start_date: '2026-03-01', naesin_class_override: '목동중1A',
  }],
};

test('buildStudentSegments: 내신 overlay가 정규를 3분할한다 (정규→내신→정규)', () => {
  const segs = buildStudentSegments(학생_내신전환, { classSettings: CS, teacherHistory: [] });
  assert.equal(segs.length, 3);
  assert.deepEqual(
    segs.map((s) => [s.start, s.end, s.classCode, s.teacher, s.kind]),
    [
      ['2026-03-01', '2026-03-19', 'HA101', 길동, '정규'],
      ['2026-03-20', '2026-05-06', '목동중1A', 길순, '내신'],
      ['2026-05-07', null, 'HA101', 길동, '정규'],
    ]
  );
  // history 없이 classSettings로 판정한 담당은 추정
  assert.ok(segs.every((s) => s.uncertain));
});

test('buildStudentSegments: 반코드가 빈 명시 내신도 정규 override 코드로 월중 전환한다', () => {
  const segs = buildStudentSegments({
    enrollments: [
      {
        account_id: 'regular-a',
        account_type: '정규',
        level_symbol: 'HA',
        class_number: '101',
        class_type: '정규',
        start_date: '2026-03-01',
        naesin_class_override: '목동중1A',
      },
      {
        account_id: 'regular-a',
        account_type: '정규',
        class_type: '내신',
        level_symbol: '',
        class_number: '',
        start_date: '2026-03-20',
        end_date: '2026-05-06',
      },
    ],
  }, { classSettings: CS, teacherHistory: [] });

  assert.deepEqual(
    segs.map((s) => [s.start, s.end, s.classCode, s.teacher, s.kind]),
    [
      ['2026-03-01', '2026-03-19', 'HA101', 길동, '정규'],
      ['2026-03-20', '2026-05-06', '목동중1A', 길순, '내신'],
      ['2026-05-07', null, 'HA101', 길동, '정규'],
    ]
  );
});

test('buildStudentSegments: 자유학기 월중 전환도 같은 정규 수강계정의 구간으로 계산한다', () => {
  const segs = buildStudentSegments({
    enrollments: [
      {
        account_id: 'regular-a',
        account_type: '정규',
        level_symbol: 'HA',
        class_number: '101',
        class_type: '정규',
        start_date: '2026-03-01',
      },
      {
        account_id: 'regular-a',
        account_type: '정규',
        level_symbol: 'HB',
        class_number: '201',
        class_type: '자유학기',
        start_date: '2026-04-01',
        end_date: '2026-04-30',
      },
    ],
  }, { classSettings: CS, teacherHistory: [] });

  assert.deepEqual(
    segs.map((s) => [s.start, s.end, s.classCode, s.teacher, s.kind]),
    [
      ['2026-03-01', '2026-03-31', 'HA101', 길동, '정규'],
      ['2026-04-01', '2026-04-30', 'HB201', 민수, '자유학기'],
      ['2026-05-01', null, 'HA101', 길동, '정규'],
    ]
  );
  assert.equal(new Set(segs.map((s) => s.accountKey)).size, 1);
});

test('buildStudentSegments: 종료일과 반코드가 없는 진행 중 자유학기도 열린 구간으로 계산한다', () => {
  const segs = buildStudentSegments({
    enrollments: [
      {
        account_id: 'regular-a',
        account_type: '정규',
        level_symbol: 'HA',
        class_number: '101',
        class_type: '정규',
        start_date: '2026-03-01',
      },
      {
        account_id: 'regular-a',
        account_type: '정규',
        class_type: '자유학기',
        start_date: '2026-04-01',
      },
    ],
  }, { classSettings: CS, teacherHistory: [] });

  assert.deepEqual(
    segs.map((s) => [s.start, s.end, s.classCode, s.teacher, s.kind]),
    [
      ['2026-03-01', '2026-03-31', 'HA101', 길동, '정규'],
      ['2026-04-01', null, 'HA101', 길동, '자유학기'],
    ]
  );
});

test('buildStudentSegments: 복수 정규 account 중 대상 account 정규 조각만 overlay로 치환한다', () => {
  const enrollments = [
    {
      account_id: 'regular-b', account_type: '정규',
      level_symbol: 'HB', class_number: '201', class_type: '정규', start_date: '2026-03-01',
    },
    {
      account_id: 'regular-a', account_type: '정규',
      level_symbol: 'HA', class_number: '101', class_type: '정규',
      start_date: '2026-03-01', naesin_class_override: '목동중1A',
    },
  ];
  const segs = buildStudentSegments({ enrollments }, { classSettings: CS, teacherHistory: [] });
  const duringOverlay = segs.filter((s) =>
    (!s.start || s.start <= '2026-04-01') && (s.end == null || s.end >= '2026-04-01')
  );
  assert.deepEqual(
    duringOverlay.map((s) => [s.accountKey, s.classCode, s.teacher]),
    [['regular-b', 'HB201', 민수], ['regular-a', '목동중1A', 길순]]
  );
  assert.ok(segs.every((s) => s.accountId === s.accountKey && s.accountType === '정규'));
});

test('buildStudentSegments: archived 종료 account를 복원하고 입력 순서가 결과를 바꾸지 않는다', () => {
  const current = [
    {
      account_id: 'regular-c', account_type: '정규',
      level_symbol: 'HA', class_number: '101', class_type: '정규', start_date: '2026-07-01',
    },
    {
      account_id: 'regular-b', account_type: '정규',
      level_symbol: 'HB', class_number: '201', class_type: '정규', start_date: '2026-06-01',
    },
  ];
  const archived = [{
    account_id: 'regular-a', account_type: '정규',
    level_symbol: 'HA', class_number: '101', class_type: '정규',
    start_date: '2026-03-01', end_date: '2026-05-31',
  }];
  const forward = buildStudentSegments(
    { enrollments: current },
    { classSettings: CS, teacherHistory: [], archivedEnrollments: archived }
  );
  const reversed = buildStudentSegments(
    { enrollments: [...current].reverse() },
    { classSettings: CS, teacherHistory: [], archivedEnrollments: [...archived].reverse() }
  );
  assert.deepEqual(reversed, forward);
  assert.deepEqual(
    forward.map((s) => [s.accountKey, s.start, s.end]),
    [
      ['regular-a', '2026-03-01', '2026-05-31'],
      ['regular-b', '2026-06-01', null],
      ['regular-c', '2026-07-01', null],
    ]
  );
});

test('buildStudentSegments: 특강·기타 계정은 제외한다', () => {
  const segs = buildStudentSegments(
    { enrollments: [{ class_number: '특강301', class_type: '특강', start_date: '2026-03-01' }] },
    { classSettings: {}, teacherHistory: [] }
  );
  assert.deepEqual(segs, []);
});

test('buildStudentSegments: 담당 변경 이력에서 세그먼트를 분할한다', () => {
  const history = [{ class_code: 'HA101', teacher: 길순, prev_teacher: 길동, changed_at: '2026-04-01T09:00:00+09:00' }];
  const segs = buildStudentSegments(
    { enrollments: [{ level_symbol: 'HA', class_number: '101', class_type: '정규', start_date: '2026-03-01' }] },
    { classSettings: {}, teacherHistory: history }
  );
  assert.deepEqual(
    segs.map((s) => [s.start, s.end, s.teacher, s.uncertain]),
    [
      ['2026-03-01', '2026-03-31', 길동, true], // 첫 레코드 이전 = prev_teacher 추정
      ['2026-04-01', null, 길순, false],
    ]
  );
});

test('buildStudentSegments: 같은 teacher로의 이력 레코드는 세그먼트를 쪼개지 않는다', () => {
  const history = [{ class_code: 'HA101', teacher: 길동, prev_teacher: 길동, changed_at: '2026-04-01T09:00:00+09:00' }];
  const segs = buildStudentSegments(
    { enrollments: [{ level_symbol: 'HA', class_number: '101', class_type: '정규', start_date: '2026-03-01' }] },
    { classSettings: CS, teacherHistory: history }
  );
  assert.equal(segs.length, 1);
  assert.equal(segs[0].teacher, 길동);
});

test('buildStudentSegments: 휴원 구간은 세그먼트를 끊지 않는다 (휴원=유지)', () => {
  const segs = buildStudentSegments(
    {
      enrollments: [{
        level_symbol: 'HA', class_number: '101', class_type: '정규',
        start_date: '2026-03-01', pause_start_date: '2026-04-01', pause_end_date: '2026-05-01', leave_sub_type: '실휴원',
      }],
    },
    { classSettings: CS, teacherHistory: [] }
  );
  assert.equal(segs.length, 1);
  assert.deepEqual([segs[0].start, segs[0].end], ['2026-03-01', null]);
});

test('buildStudentSegments: 퇴원생은 fallbackClassCodes로 최종 반 세그먼트를 구성한다(uncertain)', () => {
  const segs = buildStudentSegments(
    { enrollments: [], status: '퇴원', withdrawal_date: '2026-05-10', first_registered: '2025-01-01' },
    { classSettings: CS, teacherHistory: [], fallbackClassCodes: ['HA101'] }
  );
  assert.equal(segs.length, 1);
  assert.deepEqual(
    [segs[0].start, segs[0].end, segs[0].classCode, segs[0].teacher, segs[0].uncertain],
    ['2025-01-01', '2026-05-09', 'HA101', 길동, true]
  );
});

// ─── churnEventsForStudent ───

const 휴원요청 = {
  request_type: '휴원요청', status: 'approved', leave_start_date: '2026-04-01',
  created_at: '2026-03-25T10:00:00+09:00', requested_by: 길동, leave_sub_type: '실휴원',
};

test('churnEventsForStudent: 휴원 진입·복귀는 이벤트가 아니다', () => {
  const cycles = groupLeaveCycles([
    휴원요청,
    { request_type: '복귀요청', status: 'approved', return_date: '2026-05-01', created_at: '2026-04-25T10:00:00+09:00' },
  ]);
  assert.deepEqual(churnEventsForStudent({ status: '재원' }, cycles), []);
});

test('churnEventsForStudent: 휴원→퇴원은 퇴원일과 퇴원신청자를 귀속 기준으로 사용한다', () => {
  const cycles = groupLeaveCycles([
    휴원요청,
    { request_type: '휴원→퇴원', status: 'approved', withdrawal_date: '2026-05-01', created_at: '2026-04-20T10:00:00+09:00', requested_by: 길순 },
  ]);
  const events = churnEventsForStudent({ status: '퇴원' }, cycles);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    type: 'leave_to_withdraw', date: '2026-05-01', anchorDate: '2026-05-01', formAuthor: 길순, subType: '실휴원',
  });
});

test('churnEventsForStudent: 단독 퇴원요청은 퇴원일과 퇴원신청자를 귀속 기준으로 사용한다', () => {
  const cycles = groupLeaveCycles([
    { request_type: '퇴원요청', status: 'approved', withdrawal_date: '2026-05-01', created_at: '2026-04-20T10:00:00+09:00', requested_by: 길동 },
  ]);
  assert.deepEqual(churnEventsForStudent({ status: '퇴원' }, cycles), [
    { type: 'withdraw', date: '2026-05-01', anchorDate: '2026-05-01', formAuthor: 길동 },
  ]);
});

test('churnEventsForStudent: 사이클에 퇴원일이 없으면 학생 문서 withdrawal_date로 폴백', () => {
  const cycles = groupLeaveCycles([
    { request_type: '퇴원요청', status: 'approved', created_at: '2026-04-20T10:00:00+09:00' },
  ]);
  const events = churnEventsForStudent({ status: '퇴원', withdrawal_date: '2026-05-02' }, cycles);
  assert.deepEqual(events, [{ type: 'withdraw', date: '2026-05-02', anchorDate: '2026-05-02', formAuthor: '' }]);
});

test('churnEventsForStudent: leave_requests 누락 퇴원생은 학생 문서만으로 1건 보강', () => {
  assert.deepEqual(churnEventsForStudent({ status: '퇴원', withdrawal_date: '2026-05-03' }, []), [
    { type: 'withdraw', date: '2026-05-03', anchorDate: '2026-05-03' },
  ]);
});

test('churnEventsForStudent: 특강·기타 account 종료는 학생 이탈이 아니다', () => {
  const cycles = [
    {
      type: 'withdraw', withdrawalDate: '2026-07-01', requests: [],
      account_id: 'special-a', account_type: '특강',
    },
    {
      type: 'withdraw', withdrawalDate: '2026-07-02', requests: [],
      account_id: 'other-a', account_type: '기타',
    },
  ];
  assert.deepEqual(
    churnEventsForStudent({ status: '퇴원', withdrawal_date: '2026-07-02' }, cycles),
    []
  );
});

test('churnEventsForStudent: 다른 정규 account 유지 중 종료는 제외하고 최종 account 종료만 scoped event로 낸다', () => {
  const archivedEnrollments = [
    {
      account_id: 'regular-a', account_type: '정규',
      level_symbol: 'HA', class_number: '101', start_date: '2026-03-01', end_date: '2026-06-30',
    },
    {
      account_id: 'regular-b', account_type: '정규',
      level_symbol: 'HB', class_number: '201', start_date: '2026-03-01', end_date: '2026-07-31',
    },
  ];
  const cycles = [
    {
      type: 'withdraw', withdrawalDate: '2026-07-01', requests: [],
      account_id: 'regular-a', account_type: '정규',
    },
    {
      type: 'withdraw', withdrawalDate: '2026-08-01', requests: [],
      account_id: 'regular-b', account_type: '정규',
    },
  ];
  assert.deepEqual(
    churnEventsForStudent(
      { enrollments: [] },
      cycles,
      { archivedEnrollments, today: '2026-08-01' }
    ),
    [{
      type: 'withdraw',
      date: '2026-08-01',
      anchorDate: '2026-08-01',
      formAuthor: '',
      accountKey: 'regular-b',
      accountId: 'regular-b',
      accountType: '정규',
    }]
  );
});

test('churnEventsForStudent: 같은 account 요청·history 이탈을 한 건으로 합친다', () => {
  const archivedEnrollments = [{
    account_id: 'regular-a',
    account_type: '정규',
    class_type: '정규',
    level_symbol: 'HA',
    class_number: '101',
    start_date: '2026-03-01',
    end_date: '2026-07-09',
    end_reason: '퇴원',
  }];
  const duplicateCycles = [
    {
      type: 'withdraw', withdrawalDate: '2026-07-10', requests: [],
      account_id: 'regular-a', account_type: '정규',
    },
    {
      type: 'withdraw', withdrawalDate: '2026-07-10', requests: [],
      account_id: 'regular-a', account_type: '정규',
    },
  ];
  assert.deepEqual(
    churnEventsForStudent(
      { enrollments: [] },
      duplicateCycles,
      { archivedEnrollments, today: '2026-07-31' }
    ),
    [{
      type: 'withdraw',
      date: '2026-07-10',
      anchorDate: '2026-07-10',
      formAuthor: '',
      accountKey: 'regular-a',
      accountId: 'regular-a',
      accountType: '정규',
    }]
  );
});

test('churnEventsForStudent: unscoped 같은 날 이탈은 휴원→퇴원 우선 한 건, 다른 날짜·account는 독립', () => {
  const unscoped = churnEventsForStudent({}, [
    { type: 'withdraw', withdrawalDate: '2026-07-10', requests: [] },
    {
      type: 'leave_to_withdraw',
      withdrawalDate: '2026-07-10',
      startDate: '2026-06-01',
      requests: [{ request_type: '휴원요청', requested_by: 길동 }],
    },
    { type: 'withdraw', withdrawalDate: '2026-07-11', requests: [] },
  ], { today: '2026-07-31' });
  assert.deepEqual(
    unscoped.map((event) => [event.type, event.date]),
    [['leave_to_withdraw', '2026-07-10'], ['withdraw', '2026-07-11']]
  );

  const scoped = churnEventsForStudent({}, [
    {
      type: 'withdraw', withdrawalDate: '2026-07-10', requests: [],
      account_id: 'regular-a', account_type: '정규',
    },
    {
      type: 'withdraw', withdrawalDate: '2026-07-10', requests: [],
      account_id: 'regular-b', account_type: '정규',
    },
  ], { today: '2026-07-31' });
  assert.deepEqual(scoped.map((event) => event.accountKey), ['regular-a', 'regular-b']);
});

test('churnEventsForStudent: history-only 퇴원은 복원하고 종강은 제외한다', () => {
  const enrollment = {
    account_id: 'regular-a',
    account_type: '정규',
    class_type: '정규',
    level_symbol: 'HA',
    class_number: '101',
    start_date: '2026-03-01',
    end_date: '2026-07-09',
  };
  assert.equal(
    churnEventsForStudent(
      { enrollments: [] },
      [],
      { archivedEnrollments: [{ ...enrollment, end_reason: '퇴원' }], today: '2026-07-31' }
    )[0].date,
    '2026-07-10'
  );
  assert.deepEqual(
    churnEventsForStudent(
      { enrollments: [] },
      [],
      { archivedEnrollments: [{ ...enrollment, end_reason: '종강' }], today: '2026-07-31' }
    ),
    []
  );
});

test('churnEventsForStudent: 종강은 이탈이 아니다', () => {
  const cycles = groupLeaveCycles([
    { request_type: '종강요청', status: 'approved', created_at: '2026-06-20T10:00:00+09:00' },
  ]);
  assert.deepEqual(churnEventsForStudent({ status: '종강' }, cycles), []);
});

// ─── attributeEvent ───

const 내신전환세그 = buildStudentSegments(학생_내신전환, { classSettings: CS, teacherHistory: [] });
const withdraw = (date) => ({ type: 'withdraw', date, anchorDate: date });

test('대화 예시 a: 3/1 길동 정규 시작, 3/20 내신 전환(길순), 3/20 퇴원 → 길동 0.5 / 길순 0.5', () => {
  const result = attributeEvent(withdraw('2026-03-20'), 내신전환세그);
  assert.deepEqual(
    result.map((a) => [a.teacher, a.weight, a.rule]),
    [[길동, 0.5, 'buffer-split'], [길순, 0.5, 'buffer-split']]
  );
  assert.equal(result.reduce((sum, a) => sum + a.weight, 0), 1);
});

test('대화 예시 b: 5/7 길동 복귀 전환, 5/17 퇴원 → 길순 0.5 / 길동 0.5', () => {
  const result = attributeEvent(withdraw('2026-05-17'), 내신전환세그);
  assert.deepEqual(
    result.map((a) => [a.teacher, a.weight, a.rule]),
    [[길순, 0.5, 'buffer-split'], [길동, 0.5, 'buffer-split']]
  );
});

test('버퍼 경계: 전환일 + 14일째는 밖 ([T, T+14) 반개구간) → 현재 담당 1.0', () => {
  // 전환일 5/7 + 14일 = 5/21
  const result = attributeEvent(withdraw('2026-05-21'), 내신전환세그);
  assert.deepEqual(result.map((a) => [a.teacher, a.weight, a.rule]), [[길동, 1, 'current']]);
});

test('버퍼 경계: 13일째(5/20)까지는 버퍼 안', () => {
  const result = attributeEvent(withdraw('2026-05-20'), 내신전환세그);
  assert.equal(result.length, 2);
  assert.equal(result[0].rule, 'buffer-split');
});

test('첫 배정 14일 내 퇴원 → 이전 담당 없음 → 현재 담당 1.0', () => {
  const segs = buildStudentSegments(
    { enrollments: [{ level_symbol: 'HA', class_number: '101', class_type: '정규', start_date: '2026-03-01' }] },
    { classSettings: CS, teacherHistory: [] }
  );
  const result = attributeEvent(withdraw('2026-03-05'), segs);
  assert.deepEqual(result.map((a) => [a.teacher, a.weight, a.rule]), [[길동, 1, 'current']]);
});

test('반 이동했지만 같은 teacher(구·신 도메인 포함) → 전환 아님 → 1.0', () => {
  const segs = [
    { start: '2026-03-01', end: '2026-03-19', classCode: 'HA101', teacher: 'gildong@gw.impact7.kr', kind: '정규', uncertain: false },
    { start: '2026-03-20', end: null, classCode: 'HB201', teacher: 길동, kind: '정규', uncertain: false },
  ];
  const result = attributeEvent(withdraw('2026-03-25'), segs);
  assert.deepEqual(result.map((a) => [a.teacher, a.weight, a.rule]), [[길동, 1, 'current']]);
});

test('퇴원신청자가 교수 집합과 매칭되면 퇴원 유형과 무관하게 form-author 1.0', () => {
  const event = { type: 'leave_to_withdraw', date: '2026-06-10', anchorDate: '2026-05-10', formAuthor: 'gilsoon@gw.impact7.kr' };
  const options = { teacherEmails: [길동, 길순] };
  assert.deepEqual(attributeEvent(event, 내신전환세그, options), [
    { teacher: 'gilsoon@gw.impact7.kr', weight: 1, rule: 'form-author' },
  ]);
  assert.deepEqual(attributeEvent({ ...event, type: 'withdraw' }, 내신전환세그, options), [
    { teacher: 'gilsoon@gw.impact7.kr', weight: 1, rule: 'form-author' },
  ]);
});

test('퇴원신청자 매칭 실패 → 퇴원일 기준 버퍼 폴백 + uncertain', () => {
  const event = { type: 'leave_to_withdraw', date: '2026-05-10', anchorDate: '2026-05-10', formAuthor: 'frontdesk@impact7.kr' };
  const options = { teacherEmails: [길동, 길순] };
  const result = attributeEvent(event, 내신전환세그, options);
  // 5/10은 5/7 복귀 전환 버퍼 안 → 길순/길동 50/50, 전부 uncertain
  assert.deepEqual(
    result.map((a) => [a.teacher, a.weight, a.rule, a.uncertain]),
    [[길순, 0.5, 'buffer-split', true], [길동, 0.5, 'buffer-split', true]]
  );
  assert.deepEqual(
    attributeEvent({ ...event, type: 'withdraw' }, 내신전환세그, options),
    result
  );
});

test('세그먼트 판정 불가 → unknown 1.0 + uncertain', () => {
  assert.deepEqual(attributeEvent(withdraw('2026-01-01'), 내신전환세그), [
    { teacher: '', weight: 1, rule: 'unknown', uncertain: true },
  ]);
  assert.deepEqual(attributeEvent(withdraw('2026-03-05'), []), [
    { teacher: '', weight: 1, rule: 'unknown', uncertain: true },
  ]);
});

test('scoped ACCOUNT_END는 해당 account의 종료 전날 세그먼트에만 귀속한다', () => {
  const segments = buildStudentSegments(
    { enrollments: [] },
    {
      classSettings: CS,
      teacherHistory: [],
      archivedEnrollments: [
        {
          account_id: 'regular-a', account_type: '정규',
          level_symbol: 'HA', class_number: '101', start_date: '2026-03-01', end_date: '2026-06-30',
        },
        {
          account_id: 'regular-b', account_type: '정규',
          level_symbol: 'HB', class_number: '201', start_date: '2026-03-01',
        },
      ],
    }
  );
  const result = attributeEvent({
    type: 'withdraw',
    date: '2026-07-01',
    anchorDate: '2026-07-01',
    accountKey: 'regular-a',
    accountId: 'regular-a',
    accountType: '정규',
  }, segments);
  assert.deepEqual(result.map((a) => [a.teacher, a.weight, a.rule]), [[길동, 1, 'current']]);
});

test('버퍼 일수는 옵션으로 조정 가능 (기본 14)', () => {
  assert.equal(RETENTION_BUFFER_DAYS, 14);
  const result = attributeEvent(withdraw('2026-05-17'), 내신전환세그, { bufferDays: 7 });
  // 5/7 전환 + 7일 = 5/14 → 5/17은 밖 → 현재 담당 1.0
  assert.deepEqual(result.map((a) => [a.teacher, a.weight, a.rule]), [[길동, 1, 'current']]);
});

// ─── periodRange ───

const SEMESTERS = {
  '중등-2026-spring1': { start_date: '2026-03-01' },
  '중등-2026-spring2': { start_date: '2026-05-01' },
  '초등-2026-spring2': { start_date: '2026-04-15' }, // 다른 학부 — 간섭 금지
};

test('periodRange: 월별은 [1일, 말일]', () => {
  assert.deepEqual(periodRange({ type: 'month', value: '2026-07' }), { start: '2026-07-01', end: '2026-07-31' });
  assert.deepEqual(periodRange({ type: 'month', value: '2026-02' }), { start: '2026-02-01', end: '2026-02-28' });
});

test('periodRange: 중간 학기는 같은 학부 다음 학기 시작 전일까지', () => {
  assert.deepEqual(
    periodRange({ type: 'semester', level: '중등', value: '2026-Spring1' }, SEMESTERS),
    { start: '2026-03-01', end: '2026-04-30' }
  );
});

test('periodRange: 마지막 학기는 오늘까지', () => {
  assert.deepEqual(
    periodRange({ type: 'semester', level: '중등', value: '2026-Spring2' }, SEMESTERS),
    { start: '2026-05-01', end: todayKST() }
  );
});

test('periodRange: 해석 불가는 null 범위', () => {
  assert.deepEqual(periodRange({ type: 'semester', level: '고등', value: '2026-Spring1' }, SEMESTERS), { start: null, end: null });
  assert.deepEqual(periodRange({ type: 'month', value: '2026-13' }), { start: null, end: null });
});

// ─── aggregateRetention ───

test('aggregateRetention: 분모=기간 겹침 학생 수, 분자=기간 내 귀속 가중 합', () => {
  const seg = (teacher, start, end) => ({ start, end, classCode: 'HA101', teacher, kind: '정규', uncertain: false });
  const segmentsByStudent = new Map([
    ['s1', [seg('b@impact7.kr', '2026-06-01', '2026-07-02'), seg(길동, '2026-07-03', '2026-07-10')]],
    ['s2', [seg(길동, '2026-07-01', null)]],
    ['s3', [seg(길동, '2026-01-01', '2026-06-30')]], // 기간 밖 — 분모 제외
  ]);
  const attributionsByStudent = {
    s1: [{
      event: { type: 'withdraw', date: '2026-07-10', anchorDate: '2026-07-10' },
      attribution: [
        { teacher: 길동, weight: 0.5, rule: 'buffer-split' },
        { teacher: 'b@gw.impact7.kr', weight: 0.5, rule: 'buffer-split' }, // 구 도메인 — 같은 행으로 병합
      ],
    }],
    s2: [{
      event: { type: 'withdraw', date: '2026-08-05', anchorDate: '2026-08-05' }, // 기간 밖 — 분자 제외
      attribution: [{ teacher: 길동, weight: 1, rule: 'current' }],
    }],
  };
  const { byTeacher } = aggregateRetention({
    studentIds: ['s1', 's2', 's3'],
    segmentsByStudent,
    attributionsByStudent,
    range: { start: '2026-07-01', end: '2026-07-31' },
  });

  assert.deepEqual(Object.keys(byTeacher).sort(), ['b@impact7.kr', 길동].sort());
  assert.equal(byTeacher[길동].exposed, 2); // s1, s2
  assert.equal(byTeacher[길동].churn, 0.5);
  assert.equal(byTeacher[길동].retentionRate, 1 - 0.5 / 2);
  assert.deepEqual(byTeacher[길동].events, [{
    studentId: 's1',
    event: { type: 'withdraw', date: '2026-07-10', anchorDate: '2026-07-10' },
    weight: 0.5,
    rule: 'buffer-split',
  }]);
  assert.equal(byTeacher['b@impact7.kr'].exposed, 1);
  assert.equal(byTeacher['b@impact7.kr'].churn, 0.5);
  assert.equal(byTeacher['b@impact7.kr'].retentionRate, 0.5);
});

test('aggregateRetention: 노출 0인 강사의 유지율은 null', () => {
  const { byTeacher } = aggregateRetention({
    studentIds: ['s1'],
    segmentsByStudent: {},
    attributionsByStudent: {
      s1: [{
        event: { type: 'withdraw', date: '2026-07-10' },
        attribution: [{ teacher: 길동, weight: 1, rule: 'current' }],
      }],
    },
    range: { start: '2026-07-01', end: '2026-07-31' },
  });
  assert.equal(byTeacher[길동].exposed, 0);
  assert.equal(byTeacher[길동].retentionRate, null);
});

test('aggregateRetention: 복수 account 반복 이탈은 account exposure로 계산해 유지율이 음수가 되지 않는다', () => {
  const segment = (accountKey) => ({
    accountKey,
    accountId: accountKey,
    accountType: '정규',
    start: '2026-07-01',
    end: '2026-07-31',
    classCode: 'HA101',
    teacher: 길동,
    kind: '정규',
    uncertain: false,
  });
  const { byTeacher } = aggregateRetention({
    studentIds: ['s1'],
    segmentsByStudent: { s1: [segment('regular-a'), segment('regular-b')] },
    attributionsByStudent: {
      s1: [
        {
          event: { type: 'withdraw', date: '2026-07-10', accountKey: 'regular-a' },
          attribution: [{ teacher: 길동, weight: 1, rule: 'current' }],
        },
        {
          event: { type: 'withdraw', date: '2026-07-20', accountKey: 'regular-b' },
          attribution: [{ teacher: 길동, weight: 1, rule: 'current' }],
        },
      ],
    },
    range: { start: '2026-07-01', end: '2026-07-31' },
  });
  assert.equal(byTeacher[길동].exposed, 2);
  assert.equal(byTeacher[길동].churn, 2);
  assert.equal(byTeacher[길동].retentionRate, 0);
});

test('aggregateRetention: 기간 첫날 이탈 account의 전날 종료 세그먼트를 분모에 포함한다', () => {
  const { byTeacher } = aggregateRetention({
    studentIds: ['s1'],
    segmentsByStudent: {
      s1: [{
        accountKey: 'regular-a',
        accountId: 'regular-a',
        accountType: '정규',
        start: '2026-03-01',
        end: '2026-06-30',
        classCode: 'HA101',
        teacher: 길동,
        kind: '정규',
        uncertain: false,
      }],
    },
    attributionsByStudent: {
      s1: [{
        event: {
          type: 'withdraw',
          date: '2026-07-01',
          accountKey: 'regular-a',
          accountId: 'regular-a',
        },
        attribution: [{ teacher: 길동, weight: 1, rule: 'current' }],
      }],
    },
    range: { start: '2026-07-01', end: '2026-07-31' },
  });
  assert.deepEqual(
    [byTeacher[길동].exposed, byTeacher[길동].churn, byTeacher[길동].retentionRate],
    [1, 1, 0]
  );
});

test('aggregateRetention: 방어적으로 유지율을 0 아래로 내리지 않는다', () => {
  const { byTeacher } = aggregateRetention({
    studentIds: ['s1'],
    segmentsByStudent: {
      s1: [{
        start: '2026-07-01',
        end: '2026-07-31',
        classCode: 'HA101',
        teacher: 길동,
        kind: '정규',
        uncertain: false,
      }],
    },
    attributionsByStudent: {
      s1: [
        {
          event: { type: 'withdraw', date: '2026-07-10' },
          attribution: [{ teacher: 길동, weight: 1, rule: 'current' }],
        },
        {
          event: { type: 'withdraw', date: '2026-07-20' },
          attribution: [{ teacher: 길동, weight: 1, rule: 'current' }],
        },
      ],
    },
    range: { start: '2026-07-01', end: '2026-07-31' },
  });
  assert.equal(byTeacher[길동].retentionRate, 0);
});
