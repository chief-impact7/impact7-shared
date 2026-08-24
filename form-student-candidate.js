import { normalizePhoneDigitsKR } from './phone.js';

const FIELD_KEYS = [
    'studentName',
    'guardianPhone',
    'studentPhone',
    'school',
    'grade',
    'level',
    'privacyConsent',
];
const REQUIRED_FIELD_KEYS = ['studentName', 'guardianPhone', 'privacyConsent'];
const TRUE_CONSENT = new Set(['true', '1', 'yes', 'y', 'agree', 'agreed', '동의', '동의합니다', '예', '네', '확인']);
const LEVEL_MARKS = [['초', '초등'], ['중', '중등'], ['고', '고등']];

function text(value) {
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
    return String(value ?? '').trim();
}

function answer(answers, key) {
    if (!answers || !key) return undefined;
    return answers[key];
}

function consent(value) {
    if (Array.isArray(value)) return value.some(consent);
    if (value === true) return true;
    if (value === false || value == null) return false;
    return TRUE_CONSENT.has(text(value).toLowerCase());
}

function level(value) {
    const valueText = text(value);
    if (!valueText) return '';
    return LEVEL_MARKS.find(([mark]) => valueText.startsWith(mark))?.[1] ?? '';
}

function legacyDocumentPhoneKey(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
}

export function formStudentDocumentId(name, guardianPhone) {
    const nameText = text(name);
    const phone = legacyDocumentPhoneKey(guardianPhone);
    if (!nameText || !phone) return '';
    return `${nameText}_${phone}`.replace(/\s+/g, '_');
}

export function normalizeFormStudentMapping(mapping) {
    if (!mapping?.enabled) return { enabled: false, fields: {} };
    const fields = {};
    for (const key of FIELD_KEYS) {
        const value = text(mapping.fields?.[key]);
        if (value) fields[key] = value;
    }
    if (REQUIRED_FIELD_KEYS.some((key) => !fields[key])) return { enabled: false, fields: {} };
    return { enabled: true, fields };
}

export function extractFormStudentCandidate(answers, mapping) {
    const normalized = normalizeFormStudentMapping(mapping);
    if (!normalized.enabled) return null;

    const { fields } = normalized;
    if (!consent(answer(answers, fields.privacyConsent))) return null;

    const name = text(answer(answers, fields.studentName));
    const guardianPhoneAnswer = answer(answers, fields.guardianPhone);
    const guardianPhone = normalizePhoneDigitsKR(guardianPhoneAnswer);
    const docId = formStudentDocumentId(name, guardianPhoneAnswer);
    if (!docId) return null;

    const candidate = {
        docId,
        name,
        guardianPhone,
        level: level(answer(answers, fields.level)),
        privacyConsent: true,
    };
    const studentPhone = normalizePhoneDigitsKR(answer(answers, fields.studentPhone));
    const school = text(answer(answers, fields.school));
    const grade = text(answer(answers, fields.grade));
    if (studentPhone) candidate.studentPhone = studentPhone;
    if (school) candidate.school = school;
    if (grade) candidate.grade = grade;
    return candidate;
}
