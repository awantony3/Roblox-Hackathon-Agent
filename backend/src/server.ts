import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { config, configurationStatus } from "./config.js";
import { studioBridge } from "./studio/StudioBridge.js";
import { ReActAgent } from "./agent/ReActAgent.js";
import { isDestructiveTool, toolNames } from "./tools/registry.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  if (req.path === "/health" || req.header("x-api-key") === config.apiKey) return next();
  res.status(401).json({ error: "Unauthorized" });
});

const tasks = new Map<string, Record<string, unknown>>();
const MAX_TASKS = 100;

function pruneTasks() {
  while (tasks.size >= MAX_TASKS) {
    const oldest = tasks.keys().next().value as string | undefined;
    if (!oldest) break;
    tasks.delete(oldest);
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, name: "roblox-hackathon-agent", model: config.model }));

app.get("/api/status", (_req, res) => {
  const sessions = studioBridge.sessions();
  const configuration = configurationStatus();
  const blockers: string[] = [];
  if (!configuration.anthropicConfigured) blockers.push("ANTHROPIC_API_KEY is not configured");
  if (!sessions.some((session) => session.connected)) blockers.push("Roblox Studio plugin is not connected");
  if (configuration.apiKeyIsDefault) blockers.push("AGENT_API_KEY is still the default value");
  res.json({
    ready: blockers.length === 0,
    blockers,
    configuration,
    studio: { connectedSessions: sessions.filter((session) => session.connected).length },
    capabilities: { toolCount: toolNames().length, tools: toolNames() },
    tasks: { retained: tasks.size, limit: MAX_TASKS }
  });
});

app.post("/api/studio/connect", (req, res) => {
  studioBridge.connect(req.body.sessionId, req.body.snapshot);
  res.json({ ok: true });
});

app.get("/api/studio/sessions", (_req, res) => {
  res.json({ sessions: studioBridge.sessions().map(({ sessionId, seenAt, connected, snapshot }) => ({
    sessionId, seenAt, connected, placeId: snapshot?.placeId, gameId: snapshot?.gameId, capturedAt: snapshot?.capturedAt
  })) });
});

app.post("/api/studio/execute", async (req, res) => {
  const { sessionId, tool, input } = req.body;
  if (!sessionId || !tool || !input || typeof input !== "object") {
    return res.status(400).json({ error: "sessionId, tool, and input object are required" });
  }
  const session = studioBridge.sessions().find((item) => item.sessionId === sessionId && item.connected);
  if (!session) return res.status(409).json({ error: "Studio session is not connected" });
  const result = await studioBridge.execute(sessionId, tool, input, isDestructiveTool(tool));
  res.status(result.success ? 200 : 422).json(result);
});

app.get("/api/studio/commands/:sessionId", (req, res) => {
  res.json({ command: studioBridge.poll(req.params.sessionId) });
});

app.post("/api/studio/results/:commandId", (req, res) => {
  res.json({ accepted: studioBridge.complete(req.params.commandId, req.body) });
});

app.post("/api/agent/tasks", (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) return res.status(400).json({ error: "sessionId and message are required" });
  if (!config.anthropicApiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured" });
  const connected = studioBridge.sessions().some((session) => session.sessionId === sessionId && session.connected);
  if (!connected) return res.status(409).json({ error: "Requested Roblox Studio session is not connected" });
  pruneTasks();
  const taskId = randomUUID();
  tasks.set(taskId, { status: "running", state: "planning", events: [], createdAt: new Date().toISOString() });
  const agent = new ReActAgent();
  void agent.run(sessionId, message, (state, detail) => {
    const task = tasks.get(taskId)!;
    task.state = state;
    const events = task.events as unknown[];
    events.push({ state, detail, at: new Date().toISOString() });
    if (events.length > 100) events.splice(0, events.length - 100);
  }).then((result) => Object.assign(tasks.get(taskId)!, { status: result.success ? "complete" : "failed", result }))
    .catch((error: Error) => Object.assign(tasks.get(taskId)!, { status: "failed", error: error.message }));
  res.status(202).json({ taskId });
});

app.get("/api/agent/tasks/:taskId", (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

app.listen(config.port, () => console.log(`Roblox Hackathon Agent listening on http://localhost:${config.port}`));
