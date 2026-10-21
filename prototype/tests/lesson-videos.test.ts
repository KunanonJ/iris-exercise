import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CATALOG } from "../src/data/catalog";

test("every video lesson with a transcript has a Thai and English sample clip and poster on disk", () => {
  const videos = CATALOG.filter((item) => item.format === "video" && item.content);
  assert.ok(videos.length > 0);
  for (const item of videos) {
    assert.ok(item.video, `${item.id} has no clip`);
    for (const lang of ["th", "en"] as const) {
      for (const file of [item.video.src[lang], item.video.poster[lang]]) {
        assert.ok(existsSync(join("public", file)), `${item.id}: missing public${file} (run pnpm videos)`);
      }
    }
  }
});

test("only video lessons carry a clip", () => {
  for (const item of CATALOG.filter((c) => c.video)) assert.equal(item.format, "video", item.id);
});
