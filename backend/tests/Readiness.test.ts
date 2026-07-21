import test from "node:test";
import assert from "node:assert/strict";
import { runReadinessChecks } from "../src/readiness.js";

test("readiness reports required files and configuration without secrets", async () => {
  const report = await runReadinessChecks("/definitely-not-a-real-home");
  assert.equal(report.checks.some((check) => check.name === "Studio plugin source" && check.ok), true);
  assert.equal(report.checks.some((check) => check.name === "Installed Studio plugin" && !check.ok), true);
  assert.equal(JSON.stringify(report).includes("sk-proj"), false);
});
