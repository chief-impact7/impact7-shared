import test from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_SETTINGS_DEFAULTS, normalizeComponentSettings } from "./form-components.js";

test("값이 없으면 기본 문구로 채운다", () => {
  const result = normalizeComponentSettings(undefined);
  assert.equal(result.privacyConsent.optionLabel, COMPONENT_SETTINGS_DEFAULTS.privacyConsent.optionLabel);
  assert.equal(result.footer.text, COMPONENT_SETTINGS_DEFAULTS.footer.text);
  assert.equal(result.kakaoChannel.url, COMPONENT_SETTINGS_DEFAULTS.kakaoChannel.url);
});

test("빈 문자열은 기본값으로 되돌린다(클리어 불가)", () => {
  const result = normalizeComponentSettings({ footer: { text: "" } });
  assert.equal(result.footer.text, COMPONENT_SETTINGS_DEFAULTS.footer.text);
});

test("클라 기본 정규화는 trim·길이 제한 없이 String 변환만 한다", () => {
  const result = normalizeComponentSettings({ footer: { text: "  여백 유지  " } });
  assert.equal(result.footer.text, "  여백 유지  ");
});

test("cap을 주입하면 trim·길이 제한을 적용한다", () => {
  const cap = (text, max) => String(text === null || text === undefined ? "" : text).trim().slice(0, max);
  const result = normalizeComponentSettings({ footer: { text: "  " + "가".repeat(200) + "  " } }, cap);
  assert.equal(result.footer.text, "가".repeat(120));
});

// ─── 2026-07-05 적대적 리뷰 회귀 (C13) ───
test("공백만 있는 값은 기본값으로 대체 (클리어 불가 계약)", () => {
  const result = normalizeComponentSettings({ footer: { text: "   " } });
  assert.equal(result.footer.text, COMPONENT_SETTINGS_DEFAULTS.footer.text);
});

test("비문자열(객체·숫자) 값은 기본값으로 — '[object Object]' 노출 방지", () => {
  const result = normalizeComponentSettings({ footer: { text: { evil: true }, linkLabel: 42 } });
  assert.equal(result.footer.text, COMPONENT_SETTINGS_DEFAULTS.footer.text);
  assert.equal(result.footer.linkLabel, COMPONENT_SETTINGS_DEFAULTS.footer.linkLabel);
});
