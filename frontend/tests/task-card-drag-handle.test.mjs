import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps task drag handles off interactive buttons", async () => {
  const source = await readFile(
    new URL("../app/boards/[id]/page.tsx", import.meta.url),
    "utf8"
  );

  const buttonHandleOccurrences = [
    ...source.matchAll(
      /<button(?:(?!<\/button>)[\s\S])*?\{\.\.\.(?:taskProvided|provided)\.dragHandleProps\}/g
    ),
  ];

  assert.equal(buttonHandleOccurrences.length, 0);
  assert.match(source, /<article[\s\S]*?\{\.\.\.taskProvided\.dragHandleProps\}/);
  assert.match(source, /<article[\s\S]*?\{\.\.\.provided\.dragHandleProps\}/);
});
