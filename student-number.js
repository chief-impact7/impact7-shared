// 학생번호 파생에 쓰는 전화번호 소스 — 우선순위 순(높음 → 낮음).
export const STUDENT_NUMBER_SOURCES = ['student_phone', 'parent_phone_1', 'parent_phone_2'];

// 한국 휴대전화 표기 변형을 표준 digits('010…')로 축약 — 파생(deriveFromSource)과
// 비교 키(normalizeRegistrationNo)가 같은 규칙을 공유해야 동일 전화가 동일 번호·키로 수렴한다.
function canonicalPhoneDigits(raw) {
    let digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('82010')) digits = digits.slice(2); // '+82 010-…' (0 유지 표기)
    if (digits.length === 12 && digits.startsWith('8210')) digits = '0' + digits.slice(2); // +82 국제표기
    if (digits.length === 10 && digits.startsWith('10')) digits = '0' + digits; // 앞 0 소실(엑셀 숫자)
    return digits;
}

// 특정 소스 필드 하나에서만 6자리 파생. 숫자만 추출 후 leading 010 제거, 앞 6자리.
// 유효한 6자리를 못 만들면 빈 문자열.
export function deriveFromSource(student, source) {
    const digits = canonicalPhoneDigits(student?.[source]);
    const trimmed = digits.startsWith('010') ? digits.slice(3) : digits;
    return trimmed.length >= 6 ? trimmed.slice(0, 6) : '';
}

// 저장·조회·표시용 학생번호 형식 — 정확히 6자리 숫자.
export function isValidStudentNumber(raw) {
    return /^\d{6}$/.test(String(raw ?? '').trim());
}

// 전화번호 기반 6자리 학생번호 파생 — 최초 발급 후 불변으로 사용.
// student_phone → parent_phone_1 → parent_phone_2 순 fallback.
export function deriveStudentNumber(student) {
    for (const source of STUDENT_NUMBER_SOURCES) {
        const studentNumber = deriveFromSource(student, source);
        if (studentNumber) return { studentNumber, source };
    }
    return { studentNumber: '', source: '' };
}

// 현재 발급 소스보다 우선순위가 높은 번호가 새로 생겼는지 감지 — "본인 폰이 생겼으니
// 등록번호를 바꿀까요?" 제안용. 상위 소스에서 나온 번호가 현재 번호와 다르면 반환, 없으면 null.
// currentSource가 최상위(student_phone)이거나 불명이면 제안하지 않는다.
export function detectStudentNumberUpgrade(student, currentSource) {
    const cur = STUDENT_NUMBER_SOURCES.indexOf(currentSource);
    if (cur <= 0) return null;
    for (let i = 0; i < cur; i++) {
        const source = STUDENT_NUMBER_SOURCES[i];
        const studentNumber = deriveFromSource(student, source);
        if (studentNumber && studentNumber !== String(student?.studentNumber ?? '')) {
            return { studentNumber, source };
        }
    }
    return null;
}

export function studentNumberNameKey(name) {
    return String(name || '').replace(/\s+/g, '');
}

export function studentNumberIdentityKey(name, studentNumber) {
    const nameKey = studentNumberNameKey(name);
    const number = String(studentNumber || '').trim();
    return nameKey && number ? `${nameKey}|${number}` : '';
}

// 중복 감지·dedup용 등록번호 정규화 — 비교용 키 전용, 저장·표시용 아님.
// deriveFromSource와 같은 축약 규칙을 적용해, 같은 전화의 어떤 표기(원본 전화·+82·
// 앞 0 소실·8자리 잔여·'00' 패딩·파생 6자리)든 동일 비교 키가 되게 한다.
export function normalizeRegistrationNo(raw) {
    if (!raw) return '';
    let digits = canonicalPhoneDigits(raw);
    if (digits.length === 11 && digits.startsWith('010')) digits = digits.slice(3);
    if (digits.length === 8) digits = digits.slice(0, 6); // 파생 규칙(앞 6자리)과 동일 — '00' 패딩 포함
    return digits;
}
