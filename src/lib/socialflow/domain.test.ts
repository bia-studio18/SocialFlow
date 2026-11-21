import assert from "node:assert/strict";
import test from "node:test";
import {
  backoffMs,
  normalizeHashtags,
  priceFor,
  roleAtLeast,
  validateContent,
  withinLimit,
} from "./domain.ts";

test("hashtags are normalized and deduped", () => {
  assert.deepEqual(normalizeHashtags("#Launch, launch  Brand_01 !!"), ["launch", "brand_01"]);
});

test("instagram requires an image and tiktok is refused", () => {
  const errors = validateContent({
    caption: "Hello",
    hashtags: "",
    platforms: ["instagram", "tiktok"],
    mediaCount: 0,
    hasVideo: false,
  });
  assert.ok(errors.some((e) => e.includes("Instagram")));
  assert.ok(errors.some((e) => e.includes("TikTok")));
});

test("backoff grows and caps", () => {
  assert.equal(backoffMs(1), 30_000);
  assert.equal(backoffMs(2), 60_000);
  assert.equal(backoffMs(20), 6 * 60 * 60 * 1000);
});

test("yearly price is ten months and free stays zero", () => {
  assert.equal(priceFor("creator", "PKR", "month"), 799);
  assert.equal(priceFor("creator", "PKR", "year"), 7990);
  assert.equal(priceFor("free", "USD", "year"), 0);
});

test("roles and quotas", () => {
  assert.equal(roleAtLeast("editor", "viewer"), true);
  assert.equal(roleAtLeast("viewer", "admin"), false);
  assert.equal(withinLimit(9, 10), true);
  assert.equal(withinLimit(10, 10), false);
  assert.equal(withinLimit(1000, null), true);
});
