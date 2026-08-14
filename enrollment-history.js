import { formatDateKST } from './datetime.js';
import { LEAVE_STATUSES } from './enrollment-status.js';

function statusPayload(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  const match = value.match(/"status"\s*:\s*"([^"]+)"/)
    ?? value.match(/상태[:：]\s*([^,\s]+)/);
  return match ? { status: match[1] } : {};
}

function timestampDate(value) {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
  return null;
}

export function eventFromHistoryLog(
  docId,
  data,
  firstEnrollmentDates = new Map(),
  currentStatuses = new Map(),
) {
  const studentId = String(data?.doc_id || '');
  const timestamp = timestampDate(data?.timestamp);
  const date = timestamp && !Number.isNaN(timestamp.getTime()) ? formatDateKST(timestamp) : null;
  if (!studentId || !date) return null;

  const changeType = String(data.change_type || '');
  const beforeStatus = String(statusPayload(data.before).status || '');
  const afterStatus = String(statusPayload(data.after).status || '');
  const statusChanged = beforeStatus !== afterStatus;

  if (changeType === 'CONSULT' || (statusChanged && afterStatus === '상담')) {
    return { id: `log-${docId}`, studentId, type: 'CONSULT', date };
  }
  if (statusChanged && afterStatus === '등원예정') {
    return { id: `log-${docId}`, studentId, type: 'PLAN', date };
  }
  if (changeType === 'WITHDRAW' || (statusChanged && (afterStatus === '퇴원' || afterStatus === '종강'))) {
    return { id: `log-${docId}`, studentId, type: 'WITHDRAW', date };
  }
  if (statusChanged && LEAVE_STATUSES.has(afterStatus)) {
    return { id: `log-${docId}`, studentId, type: 'PAUSE', date, reason: afterStatus };
  }
  if (afterStatus === '재원' && LEAVE_STATUSES.has(beforeStatus)) {
    return { id: `log-${docId}`, studentId, type: 'RESUME', date };
  }
  if (afterStatus === '재원' && (beforeStatus === '퇴원' || beforeStatus === '종강')) {
    return { id: `log-${docId}`, studentId, type: 'REENROLL', date };
  }
  if (afterStatus === '재원' && (beforeStatus === '상담' || beforeStatus === '등원예정')) {
    return { id: `log-${docId}`, studentId, type: 'ENROLL', date };
  }
  if (changeType !== 'ENROLL') return null;
  if (typeof data.after === 'string' && data.after.includes('수업없음')) {
    return { id: `log-${docId}`, studentId, type: 'CONSULT', date };
  }
  const firstDate = firstEnrollmentDates.get(studentId);
  if (currentStatuses.get(studentId) === '등원예정' && firstDate && firstDate > date) {
    return { id: `log-${docId}`, studentId, type: 'PLAN', date };
  }
  return { id: `log-${docId}`, studentId, type: 'ENROLL', date };
}

export function applyEnrollmentEvent(previous, type) {
  switch (type) {
    case 'PLAN':
      return previous === null || previous === 'WITHDRAWN' ? 'PLANNED' : previous;
    case 'ENROLL':
      return 'ACTIVE';
    case 'PAUSE':
      return previous === 'ACTIVE' ? 'PAUSED' : previous;
    case 'RESUME':
      return previous === 'PAUSED' ? 'ACTIVE' : previous;
    case 'WITHDRAW':
      return previous === 'ACTIVE' || previous === 'PAUSED' ? 'WITHDRAWN' : previous;
    case 'REENROLL':
      return previous === 'WITHDRAWN' ? 'ACTIVE' : previous;
    default:
      return previous;
  }
}

export function statusAt(events, studentId, date) {
  let status = null;
  for (const event of events) {
    if (event.studentId === studentId && event.date <= date) {
      status = applyEnrollmentEvent(status, event.type);
    }
  }
  return status;
}
