// impact7 공유 — 수업이력 분류기 (SSoT)
//
// impact7DB(app.js renderHistory)와 impact7newDSC(class-history.js 비원생 수업이력)가
// 동일하게 사용한다. **여기만 고치면 양쪽에 반영**된다 (각 앱에서 npm i 로 갱신).
//
// 순수 로직(의존성 없음). 렌더/DOM/날짜포맷은 각 앱이 담당한다.
// 두 앱은 같은 Firebase 프로젝트(impact7db)의 같은 history_logs 컬렉션을 공유하므로
// before/after 데이터 형태가 동일하다.

import { formatDateKST } from './datetime.js';

// 의도적 분리: enrollment-status.js를 import하지 않는다.
// 이유: history-classifier는 로그 텍스트 파싱 전용 — 집합의 목적이 다르다(파싱 인식용).
// '종강'은 WITHDRAW 로그의 before 텍스트에 나타날 수 있어 파싱 인식만 한다(JSON 경로와 동일 결과 보장).
// enrollment-status.js의 상태 집합과 drift 위험 있음 — 상태 추가 시 두 파일 동시 확인.
const STATUSES = ['상담', '등원예정', '재원', '실휴원', '가휴원', '퇴원', '종강'];
const LEAVE = ['실휴원', '가휴원'];

// 종류별 뱃지 색 (초록=긍정/등록, 파랑=중립 변경, 빨강=퇴원)
export const HISTORY_BADGE = {
    '신규': 'badge-enroll', '복귀': 'badge-enroll', '재등원': 'badge-enroll',
    '수업배정': 'badge-enroll', '수업추가': 'badge-enroll',
    '전반': 'badge-update', '내신전환': 'badge-update', '자유학기전환': 'badge-update',
    '학기전환': 'badge-update',
    '휴원': 'badge-update', '계정휴원': 'badge-update',
    '계정재개': 'badge-enroll', '퇴원': 'badge-withdraw',
    '수업종료': 'badge-withdraw', '계정종료': 'badge-withdraw',
};

export function historyPeriodLabel(classType) {
    if (classType === '내신') return '내신전환';
    if (classType === '자유학기') return '자유학기전환';
    return '수업추가';
}

// 작성자 표시: 이메일은 @ 앞부분만, 자동전환·시스템·미상은 'system'.
export function shortAuthor(id) {
    return typeof id === 'string' && id.includes('@') ? id.split('@')[0] : 'system';
}

// 신규 표시용 반코드: "반:코드"(aC) 우선, 없으면 "신규 등록: 이름 (코드)"의 괄호 코드.
// 괄호 안에 숫자가 있는 것만 반코드로 인정 (예: (AX101)·(특강112) ⭕ / (첫데이터)·(수업없음) ❌).
function newClassCode(aC, afterText) {
    if (aC) return aC;
    return afterText.match(/\(([^)]*\d[^)]*)\)/)?.[1]?.trim() || '';
}

function accountSnapshotLabel(text) {
    if (typeof text !== 'string' || !text.trim().startsWith('{')) return '';
    try {
        const snapshot = JSON.parse(text);
        const items = Array.isArray(snapshot.items) ? snapshot.items : [];
        const item = items.find(entry => (entry?.class_type || '정규') === '정규')
            || items.find(entry => entry?.level_symbol || entry?.class_number);
        const code = `${item?.level_symbol || ''}${item?.class_number || ''}`.trim();
        return [snapshot.account_type, code].filter(Boolean).join(' ');
    } catch {
        return '';
    }
}

// 재등원·복귀 로그는 돌아온 반을 텍스트가 아니라 after의 enrollments JSON으로 싣는다.
// 그 배열은 반이동으로 끝난 조각까지 담고 있으므로(moveRegularClass가 옛 반에 end_date를
// 남긴다), 아직 끝나지 않은 조각만 현재 반으로 본다. 정규수업반을 우선 보이고,
// 정규가 없는 특강·기타만의 복귀는 가진 반을 그대로 보인다.
function enrollmentClassCodes(enrollments) {
    if (!Array.isArray(enrollments)) return '';
    const codes = enrollments.map(enrollment => ({
        code: `${enrollment?.level_symbol || ''}${enrollment?.class_number || ''}`.trim(),
        open: !enrollment?.end_date,
        regular: (enrollment?.account_type || '정규') === '정규' && (enrollment?.class_type || '정규') === '정규',
    })).filter(entry => entry.code);
    const open = codes.filter(entry => entry.open);
    const live = open.length ? open : codes;
    const regular = live.filter(entry => entry.regular);
    return [...new Set((regular.length ? regular : live).map(entry => entry.code))].join(', ');
}

// 반 목록 문자열("A104, A102") → 중복·순서·빈값 제거한 정렬 배열.
// 저장 로그는 같은 반을 두 번 적거나 순서만 바꿔 쓰므로, 집합으로 비교해야 실제 변화만 남는다.
function classList(classes) {
    return [...new Set(
        (classes || '').split(',').map(code => code.trim()).filter(code => code && code !== '—')
    )].sort();
}

// history before/after에서 상태·반코드·휴원시작일을 best-effort로 추출.
// 형태: "상태:재원, 반:A101, 요일:월,금" | "status:재원, pause_start_date:.." (일괄 import)
//      | {"status":"재원","pause_start_date":"..."} | 단독 상태문자열("재원").
export function parseStatusClass(text) {
    if (typeof text !== 'string') return { status: '', classes: '', pauseStart: '' };
    const t = text.trim();
    if (!t || t === '—') return { status: '', classes: '', pauseStart: '' };
    if (t.startsWith('{')) {
        try {
            const o = JSON.parse(t);
            return {
                status: o.status || '',
                classes: enrollmentClassCodes(o.enrollments),
                pauseStart: o.pause_start_date || '',
            };
        } catch { /* JSON 아니면 아래 파싱 */ }
    }
    // "상태:.." (편집 저장 포맷) 또는 "status:.." (일괄 import 포맷) 둘 다 인식.
    // '상태'는 낱말 시작에서만 — '건강상태:양호' 같은 합성어 오파싱 방지.
    // 값은 콤마·괄호 전까지 — 일괄퇴원 로그 "학생: 이름 (상태:실휴원)" 포맷 지원.
    const mStatus = t.match(/(?<![가-힣A-Za-z0-9])상태[:\s]*([^,)]+)/) || t.match(/(?:^|,\s*)status:\s*([^,]+)/);
    if (mStatus) {
        // 반 값은 "반:A104, A102, 요일:.." 처럼 콤마로 여러 개가 올 수 있어 다음 "키:" 직전까지 통째로 받는다.
        // 뒤따르는 키는 로그 생산자마다 다르다 — 요일(DB)·상태(서버 감사)·시작(반이동).
        // '반'도 낱말 시작에서만 — '일반:..' 같은 합성어 오파싱 방지.
        const cls = (t.match(/(?<![가-힣A-Za-z0-9])반[:\s]*(.*?)(?:,\s*[가-힣A-Za-z_]+\s*:|$)/)?.[1] || '').trim();
        const pause = (t.match(/pause_start_date:\s*([^,]*)/)?.[1] || '').trim();
        return { status: mStatus[1].trim(), classes: cls === '—' ? '' : cls, pauseStart: pause };
    }
    if (STATUSES.includes(t)) return { status: t, classes: '', pauseStart: '' };
    return { status: '', classes: '', pauseStart: '' };
}

// 학생 상태·수업 배정·기간 전환·계정 상태 변화를 일선 교사용 이력으로 분류.
// 상태 전이·휴원기간·반이동·수업추가만 노출하고 그 외(요일변경·자동활성화 등)는 숨김.
// STATUS_CHANGE는 UPDATE와 쌍으로 기록되는 중복 로그이므로 무시.
// 분류 결과 { label, from, to } 또는 null(숨김).
export function classifyHistory(log) {
    const t = log.change_type;
    if (t === 'STATUS_CHANGE' || t === 'DELETE' || t === 'PROMOTION') return null;
    if (t === 'ACCOUNT_PAUSE') return { label: '계정휴원', from: '활성', to: '휴원' };
    if (t === 'ACCOUNT_RESUME') return { label: '계정재개', from: '휴원', to: '활성' };
    if (t === 'ACCOUNT_END') return { label: '계정종료', from: accountSnapshotLabel(log.before) || '활성', to: '종료' };

    const { status: bS, classes: bC, pauseStart: bP } = parseStatusClass(log.before);
    const { status: aS, classes: aC, pauseStart: aP } = parseStatusClass(log.after);
    const afterText = typeof log.after === 'string' ? log.after : '';
    const combined = `${typeof log.before === 'string' ? log.before : ''} ${afterText}`;

    if (t === 'RESTORE' && bS === '종강' && aS === '재원') {
        const regular = afterText.match(/\(현재 정규 ([^)]+)\)/)?.[1]?.trim();
        return { label: '계정재개', from: '종료', to: regular ? `정규 ${regular}` : '활성' };
    }

    // 신규 등록 — '이전 → 정규반코드' 표시 (반코드 없으면 '등록')
    if (t === 'ENROLL') return { label: '신규', from: '', to: newClassCode(aC, afterText) || '등록' };
    // 퇴원생 "첫데이터 재입력 + 수업 추가" = 재등원 (수업 추가 없는 단순 재입력은 상태 불변이므로 숨김)
    if (bS === '퇴원' && combined.includes('재입력') && combined.includes('수업') && combined.includes('추가')) {
        return { label: '재등원', from: '퇴원', to: '재원' };
    }

    // 퇴원 (WITHDRAW: status JSON 또는 "종강→퇴원" 서술형 모두 포함)
    if (t === 'WITHDRAW') return { label: '퇴원', from: bS || '재원', to: '퇴원' };

    // 상태 전이 기반
    // 복귀·재등원 로그 하나에 상태 전이와 반 배정이 같이 담긴다(before는 상태만, after에 enrollments).
    // 어느 반으로 돌아왔는지가 상태만큼 중요하므로 함께 보인다 — 같은 저장이 '수업추가' 짝 로그를
    // 남긴 경우의 중복은 dedupeHistory가 합친다.
    const movedTo = aC ? `${aS} (${aC})` : aS;
    if (aS) {
        if (bS === '퇴원' && (aS === '재원' || aS === '등원예정')) return { label: '재등원', from: '퇴원', to: movedTo };
        // 복귀는 '재원' 직행과 '등원예정'(복귀 예약) 둘 다 — pause 기반 복귀 경로와 대칭.
        if (LEAVE.includes(bS) && (aS === '재원' || aS === '등원예정')) return { label: '복귀', from: bS, to: movedTo };
        if (LEAVE.includes(aS) && !LEAVE.includes(bS)) return { label: '휴원', from: bS || '재원', to: aS };
        if (aS === '퇴원' && bS !== '퇴원') return { label: '퇴원', from: bS || '재원', to: '퇴원' };
        if ((bS === '' || bS === '상담') && (aS === '등원예정' || aS === '재원')) return { label: '신규', from: '', to: newClassCode(aC, afterText) || '등록' };
    }

    // 휴원기간(pause_start_date) 기반 — status는 활성 유지하고 휴원 날짜만 변하는 예약 휴원/복귀 경로.
    // 이미 휴원 상태에서 날짜만 바뀐 로그는 휴원/복귀로 오판하지 않도록 가드.
    if (!bP && aP && !LEAVE.includes(bS)) return { label: '휴원', from: bS || '재원', to: '휴원' };
    if (bP && !aP && (aS === '재원' || aS === '등원예정')) return { label: '복귀', from: '휴원', to: aS };

    const assigned = afterText.match(/배정:\s*([^,(]+)/)?.[1]?.trim();
    if (assigned) return { label: '수업배정', from: '', to: assigned };

    // 수업 추가 ("추가: SP201 ... 총 N개 누적" — 수업추가 로그 시그니처. 코드 있을 때만)
    // 코드는 영문+숫자(HA103)뿐 아니라 한글(내신 csKey·특강명)도 추출 — 콤마/여는괄호 직전까지.
    if (afterText.includes('추가:') && afterText.includes('누적')) {
        const added = afterText.match(/추가:\s*([^,(]+)/)?.[1]?.trim();
        const classType = afterText.match(/\((내신|자유학기|정규|특강|기타)\)/)?.[1] || '';
        if (added) return { label: historyPeriodLabel(classType), from: '', to: added };
    }

    // 학기 롤오버 — "2026-Autumn 학기 적용 (#0 HS104 2026-Spring→2026-Autumn) [cloud-function]"
    const semesterMoves = [...afterText.matchAll(/#\d+\s+(.+?)\s+(\d{4}-[A-Za-z]+)→(\d{4}-[A-Za-z]+)/g)];
    if (semesterMoves.length) {
        const codes = [...new Set(semesterMoves.map(move => move[1]))].join(', ');
        return { label: '학기전환', from: `${codes} ${semesterMoves[0][2]}`, to: semesterMoves[0][3] };
    }

    // 반 목록 변화 — 상태 변화 없이 반이 바뀐 경우. 추가·제거를 집합으로 판정해
    // 다중 반(정규+특강·내신 병행)과 첫 배정·전체 해제까지 모두 잡는다.
    // 순서만 바뀐 로그(반:A,B → 반:B,A)는 변화 없음으로 걸러진다.
    const beforeClasses = classList(bC);
    const afterClasses = classList(aC);
    const addedClasses = afterClasses.filter(code => !beforeClasses.includes(code));
    const removedClasses = beforeClasses.filter(code => !afterClasses.includes(code));
    if (addedClasses.length && removedClasses.length) {
        return { label: '전반', from: removedClasses.join(', '), to: addedClasses.join(', ') };
    }
    if (addedClasses.length) return { label: '수업추가', from: '', to: addedClasses.join(', ') };
    if (removedClasses.length) return { label: '수업종료', from: removedClasses.join(', '), to: '종료' };

    return null;
}

// 휴원·복귀는 한 번의 저장이 status 로그와 pause 로그로 두 건 남아 같은 사건이 두 줄로 보인다.
// 이 두 라벨만 인접 병합 대상 — 반·기간 라벨은 to가 다르면 실제로 다른 수업이므로 합치지 않는다.
const LEAVE_TRANSITION_LABELS = new Set(['휴원', '복귀']);

// 복귀·재등원은 돌아온 반을 to에 담는다. 같은 저장이 '수업추가' 짝 로그도 남기면 같은 반이
// 두 줄로 보이므로, 인접한 그 짝만 흡수한다(다른 반 추가는 별개 사건이라 남긴다).
// 반코드는 접두가 겹칠 수 있어(HS1 ⊂ HS10) 문자열 포함이 아니라 코드 단위로 대조한다.
const RETURN_LABELS = new Set(['재등원', '복귀']);
const splitCodes = (text) => text.split(',').map(code => code.trim()).filter(Boolean);
function mentionsClass(returnCat, addCat) {
    const returned = splitCodes(returnCat.to.match(/\(([^)]*)\)\s*$/)?.[1] ?? '');
    const added = splitCodes(addCat.to);
    return added.length > 0 && added.every(code => returned.includes(code));
}

// 두 표현 중 실제 상태값(실휴원·가휴원 등)을 남긴다. pause 경로가 만드는 '휴원'은 모호한 fallback.
// 복귀의 to는 "재원 (PX101)"처럼 반이 붙으므로 상태 부분으로만 비교하고, 같은 상태면 반이 붙은
// 쪽을 남긴다 — 그러지 않으면 병합이 방금 살려낸 반 정보를 도로 버린다.
const statusPart = (value) => value.replace(/\s*\([^)]*\)\s*$/, '');
const preferStatus = (a, b) => {
    const [left, right] = [statusPart(a), statusPart(b)];
    if (left === right) return a.length >= b.length ? a : b;
    return STATUSES.includes(left) || !STATUSES.includes(right) ? a : b;
};

// 연속 중복 이력 병합. 입력·출력은 `{ log, cat }` 형태의 시간 역순 배열(DB·DSC 공통 렌더 계약).
export function dedupeHistory(entries) {
    const merged = [];
    for (const entry of entries) {
        const previous = merged.at(-1);
        const { label, from, to } = entry.cat;
        if (previous && previous.cat.label === label) {
            if (previous.cat.from === from && previous.cat.to === to) continue;
            if (LEAVE_TRANSITION_LABELS.has(label)) {
                previous.cat = {
                    label,
                    from: preferStatus(previous.cat.from, from),
                    to: preferStatus(previous.cat.to, to),
                };
                continue;
            }
        }
        if (previous && RETURN_LABELS.has(previous.cat.label) && label === '수업추가'
            && mentionsClass(previous.cat, entry.cat)) continue;
        if (previous && previous.cat.label === '수업추가' && RETURN_LABELS.has(label)
            && mentionsClass(entry.cat, previous.cat)) {
            merged[merged.length - 1] = { ...entry };
            continue;
        }
        merged.push({ ...entry });
    }
    return merged;
}

// 현재 재원기간(tenure): 마지막 신규/재등원 이벤트 ~ (그 뒤 퇴원이면 그 날, 아니면 진행 중).
// 규칙: 등록(신규)/재등원이 기간 시작, 퇴원이 기간 끝. 휴원/복귀는 기간을 끊지 않음(무시).
//       퇴원 후 재등원하면 새 기간 시작. (종강은 classifier 미분류 → 종강 학생의 end는 앱이 status로 보완)
// 출석으로 인정하는 상태 (결석·미확인·등원전 제외) — 양 앱 SSoT.
export function isAttendedStatus(status) {
  return status === '출석' || status === '지각' || status === '조퇴';
}

// Date → KST 'YYYY-MM-DD'는 datetime.js SSoT를 재사용 (구현·캐시 중복 방지).
// 의도적 분리 정책은 enrollment-status.js에 한정 — datetime import는 허용.

// 재원기간 파생. logs로 현재 재원 구간의 시작 이벤트(startEvent)·종료(end)를 잡고,
// attendances(그 학생의 daily_records {date,status})에서 startEvent 이후 첫 출석일을 start로.
// 반환: { start: Date|null, end: Date|null, startEvent: Date|null }
//   - startEvent=null      → 이력 없음
//   - startEvent≠null, start=null → 미등원(등원예정)
//   - start≠null           → 첫 출석일부터 재원
export function deriveTenure(logs, getDate, attendances, isCurrentlyEnrolled = false) {
  const events = (logs || [])
    .map(l => ({ cat: classifyHistory(l), date: getDate(l) }))
    .filter(e => e.cat && e.date instanceof Date && !isNaN(e.date.getTime()))
    .sort((a, b) => a.date - b.date);
  let startEvent = null, end = null;
  for (const e of events) {
    if (e.cat.label === '신규' || e.cat.label === '재등원') { startEvent = e.date; end = null; }
    else if (e.cat.label === '퇴원') { end = e.date; }
  }
  let start = null;
  if (startEvent && Array.isArray(attendances)) {
    const seStr = formatDateKST(startEvent);
    const firstAttended = attendances
      .filter(a => a && isAttendedStatus(a.status) && typeof a.date === 'string' && a.date >= seStr)
      .map(a => a.date)
      .sort()[0];
    if (firstAttended) start = new Date(firstAttended + 'T00:00:00+09:00');
  }
  // 현재 재원계열인데 history 마지막 분류가 퇴원이면 무로그 재등원으로 보고 end 무효(현재 status가 진실).
  if (end && isCurrentlyEnrolled) end = null;
  return { start, end, startEvent };
}
