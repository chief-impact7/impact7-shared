export type EnrollmentEventType =
  | 'PLAN'
  | 'ENROLL'
  | 'PAUSE'
  | 'RESUME'
  | 'WITHDRAW'
  | 'REENROLL'
  | 'CONSULT';

export type EnrollmentStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'WITHDRAWN';

export interface EnrollmentEvent {
  id: string;
  studentId: string;
  type: EnrollmentEventType;
  date: string;
  reason?: string;
}

export interface HistoryLog {
  doc_id?: unknown;
  timestamp?: unknown;
  change_type?: unknown;
  before?: unknown;
  after?: unknown;
}

export function eventFromHistoryLog(
  docId: string,
  data: HistoryLog,
  firstEnrollmentDates?: ReadonlyMap<string, string>,
  currentStatuses?: ReadonlyMap<string, string>,
): EnrollmentEvent | null;

export function applyEnrollmentEvent(
  previous: EnrollmentStatus | null,
  type: EnrollmentEventType,
): EnrollmentStatus | null;

export function statusAt(
  events: readonly EnrollmentEvent[],
  studentId: string,
  date: string,
): EnrollmentStatus | null;
