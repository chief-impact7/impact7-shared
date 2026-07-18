import test from "node:test";
import assert from "node:assert/strict";
import { RESERVED_PUBLIC_SLUGS, RESERVED_RESPONSE_SLUGS, slugify } from "./form-slug.js";

test("시스템 경로가 예약 슬러그에 포함된다", () => {
  for (const slug of ["forms-admin", "forms", "assets", "vendor", "src", "design", "index", "form", "favicon"]) {
    assert.ok(RESERVED_PUBLIC_SLUGS.has(slug), `${slug}는 예약되어야 한다`);
  }
});

test("일반 슬러그는 예약에 걸리지 않는다", () => {
  assert.equal(RESERVED_PUBLIC_SLUGS.has("summer-class-2026"), false);
});

test("uploads는 응답 예약 슬러그", () => {
  assert.ok(RESERVED_RESPONSE_SLUGS.has("uploads"));
  assert.equal(RESERVED_RESPONSE_SLUGS.has("summer"), false);
});

test("slugify: 소문자화·비영숫자 하이픈·양끝 정리", () => {
  assert.equal(slugify("Summer Class 2026"), "summer-class-2026");
  assert.equal(slugify("  --Hello, World!--  "), "hello-world");
  assert.equal(slugify("한글만"), "");
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
});

test("slugify: 최대 60자", () => {
  assert.equal(slugify("a".repeat(80)).length, 60);
});
