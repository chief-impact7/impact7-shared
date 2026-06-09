import { test } from 'node:test';
import assert from 'node:assert';
import { classifyHistory, shortAuthor, HISTORY_BADGE, parseStatusClass } from './history-classifier.js';

const label = (log) => classifyHistory(log)?.label ?? null;
const line = (log) => { const c = classifyHistory(log); return c ? `${c.label}:${c.from}>${c.to}` : null; };

test('상태 전이 분류', () => {
    assert.equal(line({ change_type: 'UPDATE', before: '{"status":"재원"}', after: '{"status":"실휴원","pause_start_date":"2026-05-01"}' }), '휴원:재원>실휴원');
    assert.equal(line({ change_type: 'RETURN', before: '{"status":"실휴원","pause_start_date":"2026-05-01"}', after: '{"status":"재원"}' }), '복귀:실휴원>재원');
    assert.equal(line({ change_type: 'RETURN', before: '{"status":"퇴원"}', after: '{"status":"재원"}' }), '재등원:퇴원>재원');
    assert.equal(line({ change_type: 'WITHDRAW', before: '{"status":"재원"}', after: '{"status":"퇴원"}' }), '퇴원:재원>퇴원');
    assert.equal(line({ change_type: 'UPDATE', before: '상태:재원, 반:A101, 요일:월, 금', after: '상태:재원, 반:A103, 요일:월, 금' }), '전반:A101>A103');
});

test('신규 — 정규반코드 표시 (없으면 등록)', () => {
    // 반:코드 있으면 그 반코드 ('등원예정' 대신)
    assert.equal(line({ change_type: 'UPDATE', before: '상태:상담, 반:—, 요일:N/A', after: '상태:등원예정, 반:A103, 요일:월, 금' }), '신규:>A103');
    assert.equal(line({ change_type: 'UPDATE', before: '상태:상담', after: '상태:재원, 반:HS201, 요일:월, 금' }), '신규:>HS201');
    // ENROLL 괄호 코드
    assert.equal(line({ change_type: 'ENROLL', before: '—', after: '신규 등록: 황시윤 (AX101)' }), '신규:>AX101');
    assert.equal(line({ change_type: 'ENROLL', before: '—', after: '신규 등록: 김지유2 (특강112)' }), '신규:>특강112');
    // 반코드 없으면 '등록' (가짜 등원예정 박지 않음)
    assert.equal(line({ change_type: 'ENROLL', before: '—', after: '신규 등록: 김채윤2 (수업없음)' }), '신규:>등록');
    assert.equal(line({ change_type: 'ENROLL', before: '—', after: '신규 등록 (첫데이터): 변지민' }), '신규:>등록');
});

test('휴원기간(pause) 기반 — status 재원 유지', () => {
    // 김채윤2 사례: status 재원인데 pause 날짜만 추가
    assert.equal(line({ change_type: 'UPDATE', before: '{"status":"재원","pause_start_date":""}', after: '{"status":"재원","pause_start_date":"2026-05-01","pause_end_date":"2026-05-30"}' }), '휴원:재원>휴원');
    // 이미 휴원 상태에서 pause 날짜만 변경 → 오판 금지(숨김)
    assert.equal(label({ change_type: 'UPDATE', before: '{"status":"실휴원","pause_start_date":"2026-04-16"}', after: '{"status":"실휴원","pause_start_date":""}' }), null);
});

test('일괄 import 영문 status: 포맷', () => {
    // 상태변화 + 수업추가 동시 → 상태변화(복귀)가 우선, 수업추가로 오분류 금지
    assert.equal(line({ change_type: 'UPDATE', before: 'status:실휴원, 추가: HA101', after: 'status:재원, 추가: HA101, 총 2개 누적' }), '복귀:실휴원>재원');
    assert.equal(line({ change_type: 'UPDATE', before: 'status:재원', after: 'status:퇴원' }), '퇴원:재원>퇴원');
});

test('수업추가 / 오탐 방지', () => {
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: SP201, (총 1개 누적)' }), '수업추가:>SP201');
    // "누적" 시그니처 없는 "추가:" 텍스트는 수업추가 아님
    assert.equal(label({ change_type: 'UPDATE', before: 'memo', after: '메모 추가: 5점 가산' }), null);
});

test('수업추가 / 한글 코드(내신 csKey·특강명) 추출', () => {
    // 특강 한글명 — DSC 반편성 마법사 로그
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: 수요특강 (특강) 누적' }), '수업추가:>수요특강');
    // 내신 csKey
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: 2단지목동중2A (내신) 누적' }), '수업추가:>2단지목동중2A');
    // 정규 영문+숫자 코드 — 여는괄호 전까지
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: HA103 (정규), 총 2개 누적' }), '수업추가:>HA103');
});

test('숨김 대상', () => {
    assert.equal(label({ change_type: 'STATUS_CHANGE', before: '{"status":"상담"}', after: '{"status":"등원예정"}' }), null);
    assert.equal(label({ change_type: 'PROMOTION', before: '중1', after: '중2' }), null);
    // 등원예정→재원 자동활성화는 노출하지 않음
    assert.equal(label({ change_type: 'UPDATE', before: '등원예정', after: '재원' }), null);
});

test('shortAuthor', () => {
    assert.equal(shortAuthor('roh@gw.impact7.kr'), 'roh');
    assert.equal(shortAuthor('auto-transition'), 'system');
    assert.equal(shortAuthor(''), 'system');
    assert.equal(shortAuthor(undefined), 'system');
});

test('HISTORY_BADGE 모든 라벨 매핑 존재', () => {
    for (const lab of ['신규', '휴원', '복귀', '퇴원', '재등원', '전반', '수업추가']) {
        assert.ok(HISTORY_BADGE[lab], `${lab} 뱃지 누락`);
    }
});

import { deriveTenure, isAttendedStatus } from './history-classifier.js';

const gd = (l) => l.date instanceof Date ? l.date : new Date(l.date);
const mkLog = (dateStr, before, after, change_type) => ({
  date: new Date(dateStr + 'T00:00:00+09:00'), before, after, change_type,
});
const att = (date, status) => ({ date, status });

test('deriveTenure: 신규 + 이후 출석 → start=첫 출석일, startEvent=신규일', () => {
  const logs = [mkLog('2026-03-01', '상담', '등원예정', 'UPDATE')];
  const attendances = [att('2026-03-10', '결석'), att('2026-03-12', '출석'), att('2026-03-20', '지각')];
  const { start, end, startEvent } = deriveTenure(logs, gd, attendances);
  assert.strictEqual(startEvent.getTime(), new Date('2026-03-01T00:00:00+09:00').getTime());
  assert.strictEqual(start.getTime(), new Date('2026-03-12T00:00:00+09:00').getTime());
  assert.strictEqual(end, null);
});

test('deriveTenure: 신규 + 출석 0건 → start=null (등원예정), startEvent 세팅', () => {
  const logs = [mkLog('2026-05-20', '상담', '등원예정', 'UPDATE')];
  const attendances = [att('2026-05-25', '결석'), att('2026-05-26', '미확인')];
  const { start, startEvent } = deriveTenure(logs, gd, attendances);
  assert.notStrictEqual(startEvent, null);
  assert.strictEqual(start, null);
});

test('deriveTenure: 재등원 → 마지막 재등원 이후 첫 출석일', () => {
  const logs = [
    mkLog('2025-01-01', '상담', '등원예정', 'UPDATE'),
    mkLog('2025-06-01', '재원', '퇴원', 'WITHDRAW'),
    mkLog('2026-02-01', '퇴원', '재원', 'UPDATE'),
  ];
  // 재등원(2026-02-01) 이전 출석은 무시, 이후 첫 출석이 start
  const attendances = [att('2025-02-10', '출석'), att('2026-02-15', '출석'), att('2026-03-01', '출석')];
  const { start, startEvent } = deriveTenure(logs, gd, attendances);
  assert.strictEqual(startEvent.getTime(), new Date('2026-02-01T00:00:00+09:00').getTime());
  assert.strictEqual(start.getTime(), new Date('2026-02-15T00:00:00+09:00').getTime());
});

test('deriveTenure: 이력 없음 → startEvent=null, start=null', () => {
  const { start, end, startEvent } = deriveTenure([], gd, []);
  assert.strictEqual(startEvent, null);
  assert.strictEqual(start, null);
  assert.strictEqual(end, null);
});

test('deriveTenure: 퇴원이면 end=퇴원일', () => {
  const logs = [
    mkLog('2025-01-01', '상담', '재원', 'UPDATE'),
    mkLog('2025-12-01', '재원', '퇴원', 'WITHDRAW'),
  ];
  const attendances = [att('2025-01-05', '출석')];
  const { start, end } = deriveTenure(logs, gd, attendances);
  assert.strictEqual(start.getTime(), new Date('2025-01-05T00:00:00+09:00').getTime());
  assert.strictEqual(end.getTime(), new Date('2025-12-01T00:00:00+09:00').getTime());
});

test('deriveTenure: 무로그 재등원(현재 재원계열) → end 무효, 신규 후 첫 출석부터', () => {
  // 신규→퇴원 후 재등원이 history에 명시되지 않은 케이스(무로그). 현재 status가 재원계열이면 end 무시.
  const logs = [
    mkLog('2026-03-12', '상담', '등원예정', 'UPDATE'),  // 신규
    mkLog('2026-03-12', '등원예정', '퇴원', 'WITHDRAW'),  // 퇴원 (재등원 로그 없음)
  ];
  const attendances = [att('2026-03-13', '출석'), att('2026-03-16', '출석')];
  const { start, end } = deriveTenure(logs, gd, attendances, true);  // isCurrentlyEnrolled
  assert.strictEqual(end, null);
  assert.strictEqual(start.getTime(), new Date('2026-03-13T00:00:00+09:00').getTime());
});

test('deriveTenure: 실제 퇴원(현재 비원생) → end 유지', () => {
  const logs = [
    mkLog('2025-01-01', '상담', '재원', 'UPDATE'),
    mkLog('2025-12-01', '재원', '퇴원', 'WITHDRAW'),
  ];
  const { end } = deriveTenure(logs, gd, [att('2025-01-05', '출석')], false);
  assert.strictEqual(end.getTime(), new Date('2025-12-01T00:00:00+09:00').getTime());
});

test('deriveTenure: attendances 미전달 → start=null (안전)', () => {
  const logs = [mkLog('2026-03-01', '상담', '등원예정', 'UPDATE')];
  const { start, startEvent } = deriveTenure(logs, gd);
  assert.notStrictEqual(startEvent, null);
  assert.strictEqual(start, null);
});

const EMPTY_PARSE = { status: '', classes: '', pauseStart: '' };

test('parseStatusClass: 비문자열·빈값·대시', () => {
  for (const v of [null, undefined, '', '—'])
    assert.deepStrictEqual(parseStatusClass(v), EMPTY_PARSE);
});

test('parseStatusClass: JSON 형식', () => {
  assert.deepStrictEqual(
    parseStatusClass('{"status":"재원"}'),
    { status: '재원', classes: '', pauseStart: '' },
  );
  assert.deepStrictEqual(
    parseStatusClass('{"status":"실휴원","pause_start_date":"2026-05-01"}'),
    { status: '실휴원', classes: '', pauseStart: '2026-05-01' },
  );
  // pause_start_date 누락 시 빈 문자열
  assert.deepStrictEqual(
    parseStatusClass('{"status":"가휴원","pause_start_date":""}'),
    { status: '가휴원', classes: '', pauseStart: '' },
  );
  // 깨진 JSON → 이후 파싱으로 fallback
  assert.deepStrictEqual(parseStatusClass('{broken'), EMPTY_PARSE);
});

test('parseStatusClass: 한글 상태: 포맷', () => {
  assert.deepStrictEqual(
    parseStatusClass('상태:재원, 반:A101, 요일:월, 금'),
    { status: '재원', classes: 'A101', pauseStart: '' },
  );
  // 반:— 는 빈 문자열로 정규화
  assert.deepStrictEqual(
    parseStatusClass('상태:등원예정, 반:—, 요일:N/A'),
    { status: '등원예정', classes: '', pauseStart: '' },
  );
  // 반 없이 상태만
  assert.deepStrictEqual(
    parseStatusClass('상태:퇴원'),
    { status: '퇴원', classes: '', pauseStart: '' },
  );
});

test('parseStatusClass: 영문 status: 포맷 (일괄 import)', () => {
  assert.deepStrictEqual(
    parseStatusClass('status:재원'),
    { status: '재원', classes: '', pauseStart: '' },
  );
  assert.deepStrictEqual(
    parseStatusClass('status:실휴원, pause_start_date:2026-05-01'),
    { status: '실휴원', classes: '', pauseStart: '2026-05-01' },
  );
  // 수업추가 동반 포맷
  assert.deepStrictEqual(
    parseStatusClass('status:재원, 추가: HA101, 총 2개 누적'),
    { status: '재원', classes: '', pauseStart: '' },
  );
});

test('parseStatusClass: 단독 상태 문자열', () => {
  assert.deepStrictEqual(parseStatusClass('재원'),    { status: '재원',    classes: '', pauseStart: '' });
  assert.deepStrictEqual(parseStatusClass('퇴원'),    { status: '퇴원',    classes: '', pauseStart: '' });
  assert.deepStrictEqual(parseStatusClass('실휴원'),  { status: '실휴원',  classes: '', pauseStart: '' });
  // STATUSES에 없는 임의 문자열
  assert.deepStrictEqual(parseStatusClass('알수없음'), EMPTY_PARSE);
});

test('isAttendedStatus: 출석/지각/조퇴만 true', () => {
  assert.strictEqual(isAttendedStatus('출석'), true);
  assert.strictEqual(isAttendedStatus('지각'), true);
  assert.strictEqual(isAttendedStatus('조퇴'), true);
  assert.strictEqual(isAttendedStatus('결석'), false);
  assert.strictEqual(isAttendedStatus('미확인'), false);
  assert.strictEqual(isAttendedStatus(undefined), false);
});
