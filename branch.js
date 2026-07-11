// 단지(지점) 파생. 내신 csKey('10단지…'/'2단지…')는 접두로,
// 정규 반번호는 첫 숫자('1xx'→2단지, '2xx'→10단지)로.
export function branchFromClassNumber(num) {
  const c = String(num ?? '').trim(); // Firestore에 숫자로 저장된 class_number 허용
  if (c.startsWith('10단지')) return '10단지'; // '2단지'·반번호 '1xx' 규칙보다 먼저
  if (c.startsWith('2단지')) return '2단지';
  const first = c[0];
  if (first === '1') return '2단지';
  if (first === '2') return '10단지';
  return '';
}

// 풀 반코드('A101' 등 문자 접두 포함)에서 단지 파생. 접두 우선, 이후 코드 내 '첫 숫자'.
// branchFromClassNumber와 달리 첫 글자가 아닌 첫 숫자를 본다 — 'A101'→'1'→2단지.
// 주의: 학년 숫자가 먼저 오는 문자열(내신 csKey '목동중1A' 등)에는 쓰지 말 것 — 그 '1'은 단지가 아니다.
export function branchFromClassCode(code) {
  const c = String(code ?? '').trim();
  if (c.startsWith('10단지')) return '10단지';
  if (c.startsWith('2단지')) return '2단지';
  const first = (c.match(/\d/) || [''])[0];
  if (first === '1') return '2단지';
  if (first === '2') return '10단지';
  return '';
}

// 학생의 소속: branch 필드 우선, 없으면 첫 enrollment의 class_number에서 파생.
export function branchFromStudent(s) {
  return s.branch || (s.enrollments?.[0] ? branchFromClassNumber(s.enrollments[0].class_number) : '');
}

// 학생의 모든 소속 지점 (여러 enrollment에서 파생된 지점 합집합).
export function branchesFromStudent(s) {
  const set = new Set();
  (s.enrollments || []).forEach((e) => {
    const b = branchFromClassNumber(e.class_number);
    if (b) set.add(b);
  });
  if (set.size === 0 && s.branch) set.add(s.branch);
  return [...set];
}
