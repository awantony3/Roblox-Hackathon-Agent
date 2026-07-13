import test from "node:test";
import assert from "node:assert/strict";
import { MeshyClient } from "../src/assets/MeshyClient.js";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" }
});

test("creates a moderated low-poly Meshy preview job", async () => {
  let sentBody: Record<string, unknown> = {};
  const client = new MeshyClient("test-key", (async (_url, init) => {
    sentBody = JSON.parse(String(init?.body));
    return response({ result: "job-123" });
  }) as typeof fetch);
  const result = await client.createPreview({ prompt: "neon treasure chest" });
  assert.equal(result.success, true);
  assert.equal((result.data as { jobId: string }).jobId, "job-123");
  assert.equal(sentBody.model_type, "lowpoly");
  assert.equal(sentBody.moderation, true);
});

test("marks a completed Meshy artifact for user review and import", async () => {
  const client = new MeshyClient("test-key", (async () => response({
    status: "SUCCEEDED", progress: 100, model_urls: { glb: "https://example.test/model.glb" }
  })) as typeof fetch);
  const result = await client.getTask({ jobId: "job-123" });
  assert.equal(result.success, true);
  assert.equal((result.data as { requiresUserCompletion: boolean }).requiresUserCompletion, true);
});

test("fails closed without a Meshy key", async () => {
  const result = await new MeshyClient("").createPreview({ prompt: "tree" });
  assert.equal(result.success, false);
  assert.match(result.error || "", /MESHY_API_KEY/);
});

test("rejects downloads before a trusted job result is polled", async () => {
  const result = await new MeshyClient("test-key").downloadArtifact({ jobId: "unknown", format: "glb" });
  assert.equal(result.success, false);
  assert.match(result.error || "", /poll the completed Meshy job/);
});
