import test from "node:test";
import assert from "node:assert/strict";
import { StudioBridge } from "../src/studio/StudioBridge.js";

test("queues a command and resolves its Studio result", async () => {
  const bridge = new StudioBridge();
  bridge.connect("session", { capturedAt: new Date().toISOString() });
  const pending = bridge.execute("session", "get_instance", { path: "Workspace.Part" });
  const command = bridge.poll("session");
  assert.equal(command?.tool, "get_instance");
  assert.equal(bridge.complete(command!.id, { success: true, data: { name: "Part" } }), true);
  assert.equal((await pending).success, true);
});

test("reports a recently connected Studio session", () => {
  const bridge = new StudioBridge();
  bridge.connect("live-session", { placeId: 123, capturedAt: new Date().toISOString() });
  const [session] = bridge.sessions();
  assert.equal(session.sessionId, "live-session");
  assert.equal(session.connected, true);
  assert.equal(session.snapshot?.placeId, 123);
});
