import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("uses localhost for the local API fallback so cookie sessions stay same-site", async () => {
  const apiSource = await readFile(new URL("../app/api.ts", import.meta.url), "utf8");

  assert.match(apiSource, /NEXT_PUBLIC_API_URL \|\| "http:\/\/localhost:5000"/);
  assert.doesNotMatch(apiSource, /127\.0\.0\.1:5000/);
});
