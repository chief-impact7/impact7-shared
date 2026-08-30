export const APPLICATION_KINDS = Object.freeze([
  {
    kind: 'diagnostic',
    formSlug: 'diagnostic-application',
    title: '진단평가 신청',
    lead: '신청을 마치면 본인 확인 후 학원과 대화를 시작합니다.',
    requiresLink: true,
    pipeline: 'application',
    welcome: '진단평가 신청이 완료되었습니다.\n담당자가 일정을 확인한 뒤 이 채팅으로 안내드립니다.\n궁금한 점은 이 대화에 남겨 주세요.',
    staffLabel: '진단평가 신청',
    enabled: true,
  },
  {
    kind: 'inquiry',
    formSlug: 'inquiry',
    title: '문의하기',
    lead: '남겨 주시면 학원에서 전화나 문자로 답드립니다.',
    requiresLink: false,
    pipeline: 'inquiry',
    welcome: null,
    staffLabel: '문의',
    enabled: false,
  },
]);

export const applicationKind = (kind) => APPLICATION_KINDS.find((item) => item.kind === kind) ?? null;
export const enabledApplicationKinds = () => APPLICATION_KINDS.filter((item) => item.enabled);
