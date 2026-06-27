import test from "node:test";
import assert from "node:assert/strict";
import { RESERVED_PUBLIC_SLUGS } from "./form-slug.js";

test("시스템 경로가 예약 슬러그에 포함된다", () => {
  for (const slug of ["forms-admin", "forms", "assets", "vendor", "src", "design", "index", "form", "favicon"]) {
    assert.ok(RESERVED_PUBLIC_SLUGS.has(slug), `${slug}는 예약되어야 한다`);
  }
});

test("일반 슬러그는 예약에 걸리지 않는다", () => {
  assert.equal(RESERVED_PUBLIC_SLUGS.has("summer-class-2026"), false);
});
