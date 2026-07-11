// 공개 폼 공통 구성요소(동의·카카오·푸터)의 기본 문구와 정규화. 스튜디오(클라)와 Cloud Run(서버)이 공유한다.
export const COMPONENT_SETTINGS_DEFAULTS = Object.freeze({
  privacyConsent: Object.freeze({
    title: "개인정보 수집 및 활용에 대한 동의서",
    notice: "[수집하는 개인정보의 항목]\n학생 이름, 학교, 학년, 보호자 연락처\n\n[개인정보 수집 및 이용 목적]\n본인 확인 및 연락\n학습 상담을 위한 제반 안내\n학습 정보 공유 및 학습프로그램 안내\n\n[개인정보 보유 및 이용기간]\n의무교육기간과 고등학교 3년\n개인정보 폐기 요청 및 퇴원 시, 5일 이내 폐기\n\n[개인정보 제공 동의 거부 권리 및 동의 거부에 따른 불이익 또는 제한 사항]\n개인 정보 제공 동의에 거부 할 권리가 있으며, 거부권 행사에 따른 어떠한 불이익도 발생하지 않습니다. 거부의 권리는 본 양식을 제출하지 않음으로써 발생합니다.\n\n본 동의서 제출일을 동의일로 간주함",
    label: "개인정보보호법 등 관련 법규에 의거하여 개인정보 수집 및 활용에 동의합니다.",
    description: "동의 후 신청 항목 표시",
    optionLabel: "동의합니다"
  }),
  marketingConsent: Object.freeze({
    label: "학원소식·입시소식 등 유용한 학원 마케팅 정보 수신에 동의합니다. (선택)",
    description: "입시 설명회·자료·이벤트 우선 안내",
    optionLabel: "동의합니다"
  }),
  kakaoChannel: Object.freeze({
    label: "▶ 카카오톡 채널 추가하고 학원 소식 받기",
    url: "https://pf.kakao.com/_xjxfqbn"
  }),
  footer: Object.freeze({
    text: "임팩트7 영어학원",
    linkLabel: "카카오톡 1:1 문의",
    linkUrl: "https://kakao.impact7.kr"
  })
});

// 서버 저장 시 적용하는 필드별 최대 길이. 클라는 cap 없이 표시용으로만 정규화한다.
// normalizeComponentSettings 반환 구조(그룹·키)도 이 표에서 파생된다.
const SETTINGS_LIMITS = Object.freeze({
  privacyConsent: { title: 120, notice: 3000, label: 300, description: 200, optionLabel: 80 },
  marketingConsent: { label: 300, description: 200, optionLabel: 80 },
  kakaoChannel: { label: 160, url: 300 },
  footer: { text: 120, linkLabel: 80, linkUrl: 300 }
});

// cap(value, maxLength)을 주입하면 서버 저장용 길이 제한을, 생략하면 클라 표시용 String 변환을 적용한다.
export function normalizeComponentSettings(value, cap) {
  const clamp = typeof cap === "function"
    ? cap
    : (text) => String(text === null || text === undefined ? "" : text);
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.entries(SETTINGS_LIMITS).map(([group, limits]) => [
    group,
    Object.fromEntries(Object.keys(limits).map((key) => {
      // 문자열이면서 공백 아닌 값만 채택 — 공백만 입력하거나 비문자열(객체 등)이 오면 기본값 유지.
      const raw = source[group] && source[group][key];
      const chosen = typeof raw === "string" && raw.trim() !== "" ? raw : COMPONENT_SETTINGS_DEFAULTS[group][key];
      return [key, clamp(chosen, limits[key])];
    })),
  ]));
}
