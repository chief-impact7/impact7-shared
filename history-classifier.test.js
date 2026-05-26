import { test } from 'node:test';
import assert from 'node:assert';
import { classifyHistory, shortAuthor, HISTORY_BADGE } from './history-classifier.js';

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
