import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("uses localhost for the local API fallback so cookie sessions stay same-site", async () => {
  const apiSource = await readFile(new URL("../app/api.ts", import.meta.url), "utf8");

  assert.match(apiSource, /configuredApiUrl \|\| "http:\/\/localhost:5000"/);
  assert.doesNotMatch(apiSource, /127\.0\.0\.1:5000/);
});

test("uses the same-origin proxy for production sessions", async () => {
  const [apiSource, nextConfigSource] = await Promise.all([
    readFile(new URL("../app/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(apiSource, /process\.env\.NODE_ENV === "production" && configuredApiUrl/);
  assert.match(nextConfigSource, /source: "\/api\/:path\*"/);
  assert.match(nextConfigSource, /source: "\/uploads\/:path\*"/);
});
