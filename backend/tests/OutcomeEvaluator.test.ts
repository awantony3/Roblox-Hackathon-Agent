import test from "node:test";
import assert from "node:assert/strict";
import { OutcomeEvaluator } from "../src/agent/OutcomeEvaluator.js";

test("passes when observable tools succeed", () => {
  const result = new OutcomeEvaluator().evaluate([
    { tool: "create_instance", result: { success: true } },
    { tool: "get_instance", result: { success: true, data: { path: "Workspace.Part" } } }
  ], "done");
  assert.equal(result.outcome, "passed");
});

test("fails when any tool fails", () => {
  const result = new OutcomeEvaluator().evaluate([{ tool: "create_script", result: { success: false, error: "bad source" } }], "");
  assert.equal(result.outcome, "failed");
  assert.match(result.evidence.join(" "), /bad source/);
});

test("is inconclusive without observations", () => {
  assert.equal(new OutcomeEvaluator().evaluate([], "no action").outcome, "inconclusive");
});

test("requires verification after a mutation", () => {
  const result = new OutcomeEvaluator().evaluate([{ tool: "create_instance", result: { success: true } }], "done");
  assert.equal(result.outcome, "inconclusive");
  assert.match(result.reason, /follow-up observation/);
});

test("accepts structural validation after a mutation", () => {
  const result = new OutcomeEvaluator().evaluate([
    { tool: "create_script", result: { success: true } },
    { tool: "validate_project", result: { success: true, data: { errorCount: 0 } } }
  ], "validated");
  assert.equal(result.outcome, "passed");
});

test("fails when runtime assertions fail", () => {
  const result = new OutcomeEvaluator().evaluate([
    { tool: "create_script", result: { success: true } },
    { tool: "run_playtest", result: { success: false, error: "Runtime assertion failed" } }
  ], "tested");
  assert.equal(result.outcome, "failed");
  assert.match(result.evidence.join(" "), /Runtime assertion failed/);
});

test("does not mark an interactive upload as complete", () => {
  const result = new OutcomeEvaluator().evaluate([{
    tool: "upload_animation_asset",
    result: { success: true, data: { requiresUserCompletion: true } }
  }], "uploaded");
  assert.equal(result.outcome, "inconclusive");
  assert.match(result.reason, /waiting for the user/);
});
