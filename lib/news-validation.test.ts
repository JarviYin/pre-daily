import assert from "node:assert/strict";
import test from "node:test";
import { parseNewsItems } from "./news-validation";

const slugs = new Set(["a", "b", "c", "d", "e"]);
const item = (slug: string, title = "真实市场新闻标题") => ({
  slug,
  title,
  story: "这是基于已知市场数据的新闻摘要。",
  significance: "这是相关市场的变化。",
  confidence: "流动性较低。",
});
const parse = (items: unknown[]) => parseNewsItems(JSON.stringify({ items }), slugs);

test("skips the overlong fourth title without losing other ranked stories", () => {
  const boundary = "字".repeat(60);
  const valid = [item("a"), item("b", boundary), item("c"), item("e")];
  assert.deepEqual(
    parse([...valid.slice(0, 3), item("d", "字".repeat(61)), valid[3]]),
    valid,
  );
});

test("uses the next valid story as headline when the first item is invalid", () => {
  const valid = [item("b"), item("c"), item("d")];
  assert.deepEqual(parse([item("a", "过短"), ...valid]), valid);
});

test("filters malformed items, unknown slugs and duplicates before counting", () => {
  const valid = [item("a"), item("b"), item("c")];
  assert.deepEqual(
    parse([null, { slug: "e" }, item("bogus"), valid[0], item("a"), ...valid.slice(1)]),
    valid,
  );
  assert.throws(
    () => parse([item("a"), item("a"), item("b"), item("bogus"), item("c", "字".repeat(61))]),
    /only 2\/5 valid distinct items/,
  );
});

test("rejects malformed JSON and a missing or non-array items envelope", () => {
  for (const raw of ["{", "{}", '{"items":{}}', '{"items":[]}']) {
    assert.throws(() => parseNewsItems(raw, slugs));
  }
});
