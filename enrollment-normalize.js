// 레거시 flat 반 필드(level_symbol·class_number·day·start_date…) → enrollments 변환과
// day·class_type 정규화의 에코시스템 정본. DB(app.js)·DSC(data-layer.js·firestore-helpers.js)에
// 3벌로 갈라져 있던 구현을 통합했다 (2026-08-02, Review/Plan/2026-08-01-guard-review.md §4).
//
// 갈라져 있던 동작 5곳은 보수적인 쪽으로 수렴:
//  · 반 정보 증거에 class_type을 세지 않는다 — 상담·퇴원 문서가 빈 '정규' enrollment로
//    둔갑해 재등록 merge 때 저장되던 회로 차단 (2026-08-01 운영 사고의 근본 원인)
//  · 숫자뿐인 level_symbol은 class_number로 이동 (DSC 보정 채택)
//  · 복수 class_type("정규,특강")은 항목으로 분리 (DB 동작 채택)
//  · 특강은 special_start_date 우선, special_end_date를 end_date로 보존 (DB 동작 채택)
//  · 기존 enrollments가 있으면 그대로 반환 — 변환은 저장이 아니라 로드 시 표시용이다
//
// 운영 전수 스캔(2026-08-02): enrollments 없는 15,392문서 중 레거시 flat 필드 보유 0건.
// 변환 분기는 과거 데이터 방어용이며, 세 구현의 차이는 현재 데이터에서 전부 no-op이었다.

export function normalizeDays(day) {
    if (!day) return [];
    if (Array.isArray(day)) return day.map(d => d.replace('요일', '').trim());
    return day.split(/[,·\s]+/).map(d => d.replace('요일', '').trim()).filter(Boolean);
}

export function normalizeClassTypes(ct) {
    if (!ct) return ['정규'];
    if (Array.isArray(ct)) return ct;
    return ct.split(/[,·\s]+/).map(s => s.trim()).filter(Boolean);
}

export function normalizeEnrollments(s) {
    if (s.enrollments?.length) return s.enrollments;
    let levelSymbol = s.level_symbol || s.level_code || '';
    let classNumber = s.class_number || '';
    if (/^\d+$/.test(levelSymbol) && !classNumber) {
        classNumber = levelSymbol;
        levelSymbol = '';
    }
    const day = normalizeDays(s.day);
    if (!levelSymbol && !classNumber && !s.start_date && !s.special_start_date && !day.length) return [];
    const classTypes = normalizeClassTypes(s.class_type);
    const toEntry = (ct, teukgangFallbackStart) => {
        const e = {
            class_type: ct,
            level_symbol: levelSymbol,
            class_number: classNumber,
            day,
            start_date: ct === '특강' ? (s.special_start_date || teukgangFallbackStart) : (s.start_date || ''),
        };
        if (ct === '특강') e.end_date = s.special_end_date || '';
        return e;
    };
    if (classTypes.length <= 1) return [toEntry(classTypes[0] || '정규', s.start_date || '')];
    return classTypes.map(ct => toEntry(ct, ''));
}
