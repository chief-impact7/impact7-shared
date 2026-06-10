// 전화번호 기반 6자리 학생번호 파생 — 최초 발급 후 불변으로 사용.
// student_phone → parent_phone_1 → parent_phone_2 순 fallback.
// 숫자만 추출 후 leading 010 제거, 앞 6자리 사용.
export function deriveStudentNumber(student) {
    const candidates = [
        ['student_phone',  student.student_phone],
        ['parent_phone_1', student.parent_phone_1],
        ['parent_phone_2', student.parent_phone_2],
    ];
    for (const [source, value] of candidates) {
        const digits = String(value ?? '').replace(/\D/g, '');
        const trimmed = digits.startsWith('010') ? digits.slice(3) : digits;
        if (trimmed.length >= 6) return { studentNumber: trimmed.slice(0, 6), source };
    }
    return { studentNumber: '', source: '' };
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
// 11자리 010 시작 → 앞 3자리 제거, 8자리 '00' 패딩 → 뒤 2자리 제거, 숫자만.
export function normalizeRegistrationNo(raw) {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('010')) digits = digits.slice(3);
    if (digits.length === 8 && digits.endsWith('00')) digits = digits.slice(0, 6);
    return digits;
}
