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
