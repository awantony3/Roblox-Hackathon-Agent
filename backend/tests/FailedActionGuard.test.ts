import test from "node:test";
import assert from "node:assert/strict";
import { FailedActionGuard } from "../src/agent/FailedActionGuard.js";

test("normalizes object key order for repeated actions", () => {
  const guard = new FailedActionGuard();
  guard.observe("create_instance", { name: "Coin", parent: "Workspace" }, { success: false, error: "bad parent" });
  assert.equal(guard.previousFailure("create_instance", { parent: "Workspace", name: "Coin" }), "bad parent");
});

test("successful action clears its failure", () => {
  const guard = new FailedActionGuard();
  const input = { path: "Workspace.Coin" };
  guard.observe("get_instance", input, { success: false, error: "missing" });
  guard.observe("get_instance", input, { success: true });
  assert.equal(guard.previousFailure("get_instance", input), undefined);
});
