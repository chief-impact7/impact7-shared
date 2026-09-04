import { test } from 'node:test';
import assert from 'node:assert';
import { classifyHistory, dedupeHistory, shortAuthor, HISTORY_BADGE, parseStatusClass } from './history-classifier.js';

const label = (log) => classifyHistory(log)?.label ?? null;
const line = (log) => { const c = classifyHistory(log); return c ? `${c.label}:${c.from}>${c.to}` : null; };

test('상태 전이 분류', () => {
    assert.equal(line({ change_type: 'UPDATE', before: '{"status":"재원"}', after: '{"status":"실휴원","pause_start_date":"2026-05-01"}' }), '휴원:재원>실휴원');
    assert.equal(line({ change_type: 'RETURN', before: '{"status":"실휴원","pause_start_date":"2026-05-01"}', after: '{"status":"재원"}' }), '복귀:실휴원>재원');
    assert.equal(line({ change_type: 'RETURN', before: '{"status":"퇴원"}', after: '{"status":"재원"}' }), '재등원:퇴원>재원');
    assert.equal(line({ change_type: 'WITHDRAW', before: '{"status":"재원"}', after: '{"status":"퇴원"}' }), '퇴원:재원>퇴원');
    assert.equal(line({ change_type: 'UPDATE', before: '상태:재원, 반:A101, 요일:월, 금', after: '상태:재원, 반:A103, 요일:월, 금' }), '전반:A101>A103');
});

test('수강계정 이력은 학생 상태 이력과 별도 라벨로 분류', () => {
    assert.equal(line({ change_type: 'ACCOUNT_PAUSE', before: '{}', after: '{}' }), '계정휴원:활성>휴원');
    assert.equal(line({ change_type: 'ACCOUNT_RESUME', before: '{}', after: '{}' }), '계정재개:휴원>활성');
    assert.equal(line({ change_type: 'ACCOUNT_END', before: '{}', after: '{}' }), '계정종료:활성>종료');
    assert.equal(line({
        change_type: 'ACCOUNT_END',
        before: JSON.stringify({
            account_type: '특강',
            items: [{ class_type: '특강', class_number: '수능인덱스 2차 수2' }],
        }),
        after: '{}',
    }), '계정종료:특강 수능인덱스 2차 수2>종료');
    assert.equal(line({
        change_type: 'ACCOUNT_END',
        before: JSON.stringify({
            account_type: '정규',
            items: [
                { class_type: '내신', class_number: '2단지홍익여고A' },
                { class_type: '정규', level_symbol: 'HX', class_number: '104' },
            ],
        }),
        after: '{}',
    }), '계정종료:정규 HX104>종료');
    assert.equal(line({
        change_type: 'RESTORE',
        before: '상태:종강, 수업:없음 (자동삭제 사고)',
        after: '상태:재원, 사고 직전 수업 이력 전체 복구 (현재 정규 SE201)',
    }), '계정재개:종료>정규 SE201');
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
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: 2단지목동중2A (내신) 누적' }), '내신전환:>2단지목동중2A');
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: HX104 (자유학기) 누적' }), '자유학기전환:>HX104');
    // 정규 영문+숫자 코드 — 여는괄호 전까지
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: HA103 (정규), 총 2개 누적' }), '수업추가:>HA103');
});

test('첫 수업 배정은 기존 수업에 더하는 추가와 구분한다', () => {
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '배정: HX104, 총 1개 누적' }), '수업배정:>HX104');
    assert.equal(line({ change_type: 'UPDATE', before: '—', after: '추가: SP201, 총 2개 누적' }), '수업추가:>SP201');
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

test('복귀·재등원 — enrollments JSON에서 돌아온 반을 꺼낸다', () => {
    // 실제 RETURN 로그: before는 상태만, after에 enrollments가 실린다 (최이신 08-20 사례)
    assert.equal(line({
        change_type: 'RETURN',
        before: '{"status":"실휴원","pause_start_date":"2026-07-20"}',
        after: '{"status":"재원","pause_start_date":"","enrollments":[{"account_type":"정규","class_type":"정규","level_symbol":"PX","class_number":"101"}]}',
    }), '복귀:실휴원>재원 (PX101)');
    // 정규수업반을 우선 보인다 (특강이 섞여도 정규만)
    assert.equal(line({
        change_type: 'RETURN',
        before: '{"status":"퇴원"}',
        after: '{"status":"재원","enrollments":[{"account_type":"특강","class_type":"특강","class_number":"수능인덱스 3차 토2"},{"account_type":"정규","class_type":"정규","level_symbol":"HS","class_number":"202"}]}',
    }), '재등원:퇴원>재원 (HS202)');
    // 정규가 없으면 가진 반을 그대로
    assert.equal(line({
        change_type: 'RETURN',
        before: '{"status":"퇴원"}',
        after: '{"status":"재원","enrollments":[{"account_type":"특강","class_type":"특강","class_number":"수요특강"}]}',
    }), '재등원:퇴원>재원 (수요특강)');
    // enrollments 없는 로그는 상태만 (기존 계약 유지)
    assert.equal(line({ change_type: 'RETURN', before: '{"status":"퇴원"}', after: '{"status":"재원"}' }), '재등원:퇴원>재원');
    // 반이동으로 끝난 조각(end_date 있음)은 돌아온 반이 아니다 — 현재 반만 보인다
    assert.equal(line({
        change_type: 'RETURN',
        before: '{"status":"실휴원"}',
        after: '{"status":"재원","enrollments":[{"account_type":"정규","class_type":"정규","level_symbol":"A","class_number":"101","end_date":"2026-05-31"},{"account_type":"정규","class_type":"정규","level_symbol":"B","class_number":"202"}]}',
    }), '복귀:실휴원>재원 (B202)');
});

test('dedupeHistory: 휴원·복귀 병합이 살려낸 반 정보를 버리지 않는다', () => {
    const entry = (label, from, to) => ({ log: {}, cat: { label, from, to } });
    // 같은 저장의 status 경로·pause 경로 복귀 두 건 — 순서와 무관하게 반이 남는다
    assert.deepStrictEqual(
        dedupeHistory([entry('복귀', '실휴원', '재원 (PX101)'), entry('복귀', '휴원', '재원')]).map(x => x.cat),
        [{ label: '복귀', from: '실휴원', to: '재원 (PX101)' }],
    );
    assert.deepStrictEqual(
        dedupeHistory([entry('복귀', '휴원', '재원'), entry('복귀', '실휴원', '재원 (PX101)')]).map(x => x.cat),
        [{ label: '복귀', from: '실휴원', to: '재원 (PX101)' }],
    );
});

test('dedupeHistory: 복귀와 같은 반 수업추가 짝 로그는 한 줄로', () => {
    const entry = (label, from, to) => ({ log: {}, cat: { label, from, to } });
    // 같은 저장이 남긴 RETURN 두 건 — 순서와 무관하게 복귀 줄만 남는다 (함지현 08-28 사례)
    assert.deepStrictEqual(
        dedupeHistory([entry('수업추가', '', 'HX101'), entry('재등원', '퇴원', '재원 (HX101)')]).map(x => x.cat),
        [{ label: '재등원', from: '퇴원', to: '재원 (HX101)' }],
    );
    assert.deepStrictEqual(
        dedupeHistory([entry('재등원', '퇴원', '재원 (HX101)'), entry('수업추가', '', 'HX101')]).map(x => x.cat),
        [{ label: '재등원', from: '퇴원', to: '재원 (HX101)' }],
    );
    // 다른 반 추가는 별개 사건이라 남긴다
    assert.equal(dedupeHistory([
        entry('복귀', '실휴원', '재원 (PX101)'),
        entry('수업추가', '', 'SP201'),
    ]).length, 2);
    // 반코드 접두가 겹쳐도 코드 단위로 대조한다 (HS1 ⊄ HS101)
    assert.equal(dedupeHistory([
        entry('복귀', '실휴원', '재원 (HS101)'),
        entry('수업추가', '', 'HS1'),
    ]).length, 2);
    // 복귀가 돌아온 반을 모두 담고 있으면 그 추가 줄은 흡수한다
    assert.equal(dedupeHistory([
        entry('재등원', '퇴원', '재원 (A101, B202)'),
        entry('수업추가', '', 'B202'),
    ]).length, 1);
});

test('반 목록 변화 — 다중 반·첫 배정·전체 해제', () => {
    // 정규+특강 병행처럼 반이 여러 개여도 바뀐 반만 잡는다
    assert.equal(line({
        change_type: 'UPDATE',
        before: '상태:재원, 반:A102, FT102, 요일:화, 목',
        after: '상태:재원, 반:A103, FT102, 요일:화, 목',
    }), '전반:A102>A103');
    // 중복 등록된 반 하나가 다른 반으로 바뀐 로그는 "그 반이 늘었다"로 읽는다
    // (이지훈 SP101,SP101 → SP201,SP101 사례 — SP101 소속은 그대로 유지)
    assert.equal(line({
        change_type: 'UPDATE',
        before: '상태:재원, 반:SP101, SP101, 요일:월, 수, 금',
        after: '상태:재원, 반:SP201, SP101, 요일:월, 수, 금',
    }), '수업추가:>SP201');
    // 첫 배정 — before 쪽 반이 비어도 수업추가로 보인다 (임채윤 HX106 사례)
    assert.equal(line({
        change_type: 'UPDATE',
        before: '상태:퇴원, 반:—, 요일:N/A',
        after: '상태:퇴원, 반:HX106, 요일:화, 목',
    }), '수업추가:>HX106');
    // 반 추가 — 기존 반 유지하고 하나 늘어남 (박민아 수토102 사례)
    assert.equal(line({
        change_type: 'UPDATE',
        before: '상태:재원, 반:AX101, FT101, 요일:월, 금',
        after: '상태:재원, 반:FT101, AX101, 수토102, 요일:월, 금, 수, 토',
    }), '수업추가:>수토102');
    // 전체 해제 (김시헌 HS201 사례)
    assert.equal(line({
        change_type: 'UPDATE',
        before: '상태:재원, 반:HS201, 요일:월, 금',
        after: '상태:재원, 반:—, 요일:월, 금',
    }), '수업종료:HS201>종료');
});

test('반 목록 노이즈는 숨김 — 순서·중복만 다른 로그', () => {
    assert.equal(label({
        change_type: 'UPDATE',
        before: '상태:가휴원, 반:HS201, 10단지 여름특강 고급A, 요일:월, 금',
        after: '상태:가휴원, 반:10단지 여름특강 고급A, HS201, 요일:월, 금',
    }), null);
    assert.equal(label({
        change_type: 'UPDATE',
        before: '상태:재원, 반:HX108, 요일:화, 목',
        after: '상태:재원, 반:HX108, HX108, 요일:화, 목',
    }), null);
    // 요일만 바뀐 로그도 그대로 숨김
    assert.equal(label({
        change_type: 'UPDATE',
        before: '상태:재원, 반:A104, A102, 요일:화, 목',
        after: '상태:재원, 반:A104, A102, 요일:목, 화',
    }), null);
});

test('반 값 뒤에 다른 키가 오는 생산자 포맷 — 키 값을 반코드로 오인하지 않는다', () => {
    // impact7-functions 서버 자동 감사 로그: "반: …, 상태:…" (요일 키 없음)
    assert.equal(label({
        change_type: 'UPDATE',
        before: '반: 정규정규 A101, 상태:재원',
        after: '반: 정규정규 A101, 상태:종강 [서버 자동 기록]',
    }), null);
    // DSC 반이동·어시스턴트 로그: "상태:…, 반:…, 시작:…"
    assert.equal(line({
        change_type: 'UPDATE',
        before: '상태:재원, 반:A101',
        after: '상태:재원, 반:A102, 시작:2026-09-04',
    }), '전반:A101>A102');
    assert.deepStrictEqual(
        parseStatusClass('반: 정규정규 A101, 상태:재원'),
        { status: '재원', classes: '정규정규 A101', pauseStart: '' },
    );
});

test('학기 롤오버 — 반코드와 학기 전환을 표시', () => {
    // 반 이름에 공백이 있어도 코드 전체를 잡는다 (특강명 사례)
    assert.equal(line({
        change_type: 'UPDATE',
        before: '학기 롤오버 대상 1건',
        after: '2026-Autumn 학기 적용 (#0 10단지 여름특강 고급A 2026-Spring→2026-Autumn) [cloud-function]',
    }), '학기전환:10단지 여름특강 고급A 2026-Spring>2026-Autumn');
    assert.equal(line({
        change_type: 'UPDATE',
        before: '학기 롤오버 대상 1건',
        after: '2026-Autumn 학기 적용 (#0 HS104 2026-Spring→2026-Autumn) [cloud-function]',
    }), '학기전환:HS104 2026-Spring>2026-Autumn');
    // 분할 표기가 붙어도 학기만 뽑는다
    assert.equal(line({
        change_type: 'UPDATE',
        before: '학기 롤오버 대상 1건',
        after: '2026-Summer 학기 적용 (#0 AX101 2026-Spring→2026-Summer (2026-07-20 분할)) [cloud-function]',
    }), '학기전환:AX101 2026-Spring>2026-Summer');
});

test('dedupeHistory: 휴원·복귀는 한 줄로 합치고 구체 상태를 남긴다', () => {
    const entry = (label, from, to) => ({ log: {}, cat: { label, from, to } });
    // 같은 저장이 status·pause 로그로 두 건 남은 휴원 (서윤하 08/31 사례)
    assert.deepStrictEqual(
        dedupeHistory([entry('휴원', '재원', '실휴원'), entry('휴원', '재원', '휴원')]).map(x => x.cat),
        [{ label: '휴원', from: '재원', to: '실휴원' }],
    );
    // 모호한 '휴원'이 먼저 와도 실제 상태값을 남긴다
    assert.deepStrictEqual(
        dedupeHistory([entry('휴원', '재원', '휴원'), entry('휴원', '재원', '가휴원')]).map(x => x.cat),
        [{ label: '휴원', from: '재원', to: '가휴원' }],
    );
    // 복귀는 from 쪽이 갈린다 (pause 경로 '휴원' vs status 경로 '실휴원')
    assert.deepStrictEqual(
        dedupeHistory([entry('복귀', '휴원', '재원'), entry('복귀', '실휴원', '재원')]).map(x => x.cat),
        [{ label: '복귀', from: '실휴원', to: '재원' }],
    );
});

test('dedupeHistory: 완전 동일만 합치고 다른 수업은 남긴다', () => {
    const entry = (label, from, to) => ({ log: {}, cat: { label, from, to } });
    // 같은 반 전환이 3번 기록돼도 한 줄 (이지훈 내신전환 사례)
    assert.equal(dedupeHistory([
        entry('내신전환', '', '10단지목일중3A'),
        entry('내신전환', '', '10단지목일중3A'),
        entry('내신전환', '', '10단지목일중3A'),
    ]).length, 1);
    // 서로 다른 반 추가는 각각 남긴다 (이지훈 04/02 SP201·SP101 사례)
    assert.deepStrictEqual(
        dedupeHistory([entry('수업추가', '', 'SP201'), entry('수업추가', '', 'SP101')]).map(x => x.cat.to),
        ['SP201', 'SP101'],
    );
    // 인접하지 않으면 합치지 않는다 (휴원 → 복귀 → 휴원)
    assert.equal(dedupeHistory([
        entry('휴원', '재원', '실휴원'),
        entry('복귀', '실휴원', '재원'),
        entry('휴원', '재원', '실휴원'),
    ]).length, 3);
    assert.deepStrictEqual(dedupeHistory([]), []);
});

test('HISTORY_BADGE 모든 라벨 매핑 존재', () => {
    for (const lab of [
        '신규', '휴원', '복귀', '퇴원', '재등원', '전반', '수업배정', '수업추가',
        '수업종료', '내신전환', '자유학기전환', '학기전환',
        '계정휴원', '계정재개', '계정종료',
    ]) {
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

test('deriveTenure: ACCOUNT_END는 일부 계정 종료이므로 재원기간을 끝내지 않음', () => {
  const logs = [
    mkLog('2025-01-01', '상담', '재원', 'UPDATE'),
    mkLog('2025-06-01', '{"account_id":"regular-a"}', '{"end_reason":"종강"}', 'ACCOUNT_END'),
  ];
  const { start, end } = deriveTenure(logs, gd, [att('2025-01-05', '출석')]);
  assert.strictEqual(start.getTime(), new Date('2025-01-05T00:00:00+09:00').getTime());
  assert.strictEqual(end, null);
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
  // 반이 여러 개면 '요일' 직전까지 통째로 (콤마 포함)
  assert.deepStrictEqual(
    parseStatusClass('상태:재원, 반:FT102, A102, 수토102, 요일:화, 목, 토'),
    { status: '재원', classes: 'FT102, A102, 수토102', pauseStart: '' },
  );
  // 요일 키가 없으면 문자열 끝까지
  assert.deepStrictEqual(
    parseStatusClass('상태:재원, 반:A101'),
    { status: '재원', classes: 'A101', pauseStart: '' },
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

// ─── 2026-07-05 적대적 리뷰 회귀 (C9·C10·C17) ───
test('복귀: 실휴원/가휴원→등원예정(복귀 예약)도 복귀로 분류 — pause 경로와 대칭', () => {
  assert.deepEqual(
    classifyHistory({ change_type: 'UPDATE', before: '상태:실휴원', after: '상태:등원예정' }),
    { label: '복귀', from: '실휴원', to: '등원예정' }
  );
  assert.deepEqual(
    classifyHistory({ change_type: 'UPDATE', before: '상태:가휴원', after: '상태:재원' }),
    { label: '복귀', from: '가휴원', to: '재원' }
  );
});

test("단독 상태문자열 '종강' 파싱 — JSON 경로와 동일 결과", () => {
  assert.equal(parseStatusClass('종강').status, '종강');
  assert.equal(parseStatusClass('{"status":"종강"}').status, '종강');
  assert.deepEqual(
    classifyHistory({ change_type: 'WITHDRAW', before: '종강', after: '퇴원' }),
    { label: '퇴원', from: '종강', to: '퇴원' }
  );
});

test("'상태' 키는 앵커 매칭 — 자유 텍스트의 '건강상태:' 오파싱 방지", () => {
  assert.equal(parseStatusClass('특이사항: 건강상태:양호, 기타').status, '');
  assert.equal(parseStatusClass('상태:재원, 반:A101').status, '재원');
  assert.equal(parseStatusClass('반:A101, 상태:재원').status, '재원');
});

test("일괄퇴원 로그 '학생: 이름 (상태:실휴원)' 포맷 — 괄호 안 상태를 정확히 추출", () => {
  assert.equal(parseStatusClass('학생: 홍길동 (상태:실휴원)').status, '실휴원'); // 구 코드는 '실휴원)'로 괄호까지 캡처
  assert.deepEqual(
    classifyHistory({ change_type: 'WITHDRAW', before: '학생: 홍길동 (상태:실휴원)', after: '일괄 퇴원 처리' }),
    { label: '퇴원', from: '실휴원', to: '퇴원' }
  );
});

test("공백 구분 위치의 '상태:'도 낱말 시작이면 인식", () => {
  assert.equal(parseStatusClass('반:A101 상태:재원').status, '재원');
});
