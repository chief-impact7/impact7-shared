// impact7 공유 — 수업이력 분류기 (SSoT)
//
// impact7DB(app.js renderHistory)와 impact7newDSC(class-history.js 비원생 수업이력)가
// 동일하게 사용한다. **여기만 고치면 양쪽에 반영**된다 (각 앱에서 npm i 로 갱신).
//
// 순수 로직(의존성 없음). 렌더/DOM/날짜포맷은 각 앱이 담당한다.
// 두 앱은 같은 Firebase 프로젝트(impact7db)의 같은 history_logs 컬렉션을 공유하므로
// before/after 데이터 형태가 동일하다.

const STATUSES = ['상담', '등원예정', '재원', '실휴원', '가휴원', '퇴원'];
const LEAVE = ['실휴원', '가휴원'];

// 종류별 뱃지 색 (초록=긍정/등록, 파랑=중립 변경, 빨강=퇴원)
export const HISTORY_BADGE = {
    '신규': 'badge-enroll', '복귀': 'badge-enroll', '재등원': 'badge-enroll', '수업추가': 'badge-enroll',
    '전반': 'badge-update', '휴원': 'badge-update', '퇴원': 'badge-withdraw',
};

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
            return { status: o.status || '', classes: '', pauseStart: o.pause_start_date || '' };
        } catch { /* JSON 아니면 아래 파싱 */ }
    }
    // "상태:.." (편집 저장 포맷) 또는 "status:.." (일괄 import 포맷) 둘 다 인식
    const mStatus = t.match(/상태[:\s]*([^,]+)/) || t.match(/(?:^|,\s*)status:\s*([^,]+)/);
    if (mStatus) {
        const cls = (t.match(/반[:\s]*([^,]*?)(?:,\s*요일|$)/)?.[1] || '').trim();
        const pause = (t.match(/pause_start_date:\s*([^,]*)/)?.[1] || '').trim();
        return { status: mStatus[1].trim(), classes: cls === '—' ? '' : cls, pauseStart: pause };
    }
    if (STATUSES.includes(t)) return { status: t, classes: '', pauseStart: '' };
    return { status: '', classes: '', pauseStart: '' };
}

// 수업이력을 7종(신규/휴원/복귀/퇴원/재등원/전반/수업추가)으로만 분류 — 일선 교사용.
// 상태 전이·휴원기간·반이동·수업추가만 노출하고 그 외(요일변경·자동활성화 등)는 숨김.
// STATUS_CHANGE는 UPDATE와 쌍으로 기록되는 중복 로그이므로 무시.
// 분류 결과 { label, from, to } 또는 null(숨김).
export function classifyHistory(log) {
    const t = log.change_type;
    if (t === 'STATUS_CHANGE' || t === 'DELETE' || t === 'PROMOTION') return null;

    const { status: bS, classes: bC, pauseStart: bP } = parseStatusClass(log.before);
    const { status: aS, classes: aC, pauseStart: aP } = parseStatusClass(log.after);
    const afterText = typeof log.after === 'string' ? log.after : '';
    const combined = `${typeof log.before === 'string' ? log.before : ''} ${afterText}`;

    // 신규 등록 — '이전 → 정규반코드' 표시 (반코드 없으면 '등록')
    if (t === 'ENROLL') return { label: '신규', from: '', to: newClassCode(aC, afterText) || '등록' };
    // 퇴원생 "첫데이터 재입력 + 수업 추가" = 재등원 (수업 추가 없는 단순 재입력은 상태 불변이므로 숨김)
    if (bS === '퇴원' && combined.includes('재입력') && combined.includes('수업') && combined.includes('추가')) {
        return { label: '재등원', from: '퇴원', to: '재원' };
    }

    // 퇴원 (WITHDRAW: status JSON 또는 "종강→퇴원" 서술형 모두 포함)
    if (t === 'WITHDRAW') return { label: '퇴원', from: bS || '재원', to: '퇴원' };

    // 상태 전이 기반
    if (aS) {
        if (bS === '퇴원' && (aS === '재원' || aS === '등원예정')) return { label: '재등원', from: '퇴원', to: aS };
        if (LEAVE.includes(bS) && aS === '재원') return { label: '복귀', from: bS, to: '재원' };
        if (LEAVE.includes(aS) && !LEAVE.includes(bS)) return { label: '휴원', from: bS || '재원', to: aS };
        if (aS === '퇴원' && bS !== '퇴원') return { label: '퇴원', from: bS || '재원', to: '퇴원' };
        if ((bS === '' || bS === '상담') && (aS === '등원예정' || aS === '재원')) return { label: '신규', from: '', to: newClassCode(aC, afterText) || '등록' };
    }

    // 휴원기간(pause_start_date) 기반 — status는 활성 유지하고 휴원 날짜만 변하는 예약 휴원/복귀 경로.
    // 이미 휴원 상태에서 날짜만 바뀐 로그는 휴원/복귀로 오판하지 않도록 가드.
    if (!bP && aP && !LEAVE.includes(bS)) return { label: '휴원', from: bS || '재원', to: '휴원' };
    if (bP && !aP && (aS === '재원' || aS === '등원예정')) return { label: '복귀', from: '휴원', to: aS };

    // 수업 추가 ("추가: SP201 ... 총 N개 누적" — 수업추가 로그 시그니처. 코드 있을 때만)
    if (afterText.includes('추가:') && afterText.includes('누적')) {
        const added = afterText.match(/추가:\s*([A-Za-z]*\d+)/)?.[1];
        if (added) return { label: '수업추가', from: '', to: added };
    }

    // 전반: 상태 변화 없이 반코드 변경
    if (bC && aC && bC !== aC) return { label: '전반', from: bC, to: aC };

    return null;
}
