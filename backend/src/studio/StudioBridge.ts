import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { StudioCommand, StudioSnapshot, ToolResult } from "../types.js";

type Pending = { command: StudioCommand; resolve: (result: ToolResult) => void; timer: NodeJS.Timeout };

export class StudioBridge {
  private snapshots = new Map<string, StudioSnapshot>();
  private lastSeen = new Map<string, string>();
  private queues = new Map<string, StudioCommand[]>();
  private pending = new Map<string, Pending>();

  connect(sessionId: string, snapshot: StudioSnapshot) {
    this.snapshots.set(sessionId, snapshot);
    this.lastSeen.set(sessionId, new Date().toISOString());
    if (!this.queues.has(sessionId)) this.queues.set(sessionId, []);
  }

  snapshot(sessionId: string) {
    return this.snapshots.get(sessionId);
  }

  sessions() {
    return [...this.lastSeen.entries()].map(([sessionId, seenAt]) => ({
      sessionId,
      seenAt,
      connected: Date.now() - Date.parse(seenAt) < 5_000,
      snapshot: this.snapshots.get(sessionId)
    }));
  }

  poll(sessionId: string) {
    const queue = this.queues.get(sessionId) || [];
    const command = queue.shift();
    if (command) command.status = "running";
    return command || null;
  }

  execute(sessionId: string, tool: string, input: Record<string, unknown>, destructive = false): Promise<ToolResult> {
    const command: StudioCommand = {
      id: randomUUID(), sessionId, tool, input, destructive,
      status: "pending", createdAt: new Date().toISOString()
    };
    const queue = this.queues.get(sessionId) || [];
    queue.push(command);
    this.queues.set(sessionId, queue);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.id);
        resolve({ success: false, error: `Studio did not answer within ${config.studioTimeoutMs}ms` });
      }, config.studioTimeoutMs);
      this.pending.set(command.id, { command, resolve, timer });
    });
  }

  complete(commandId: string, result: ToolResult) {
    const entry = this.pending.get(commandId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    entry.command.status = result.success ? "complete" : "failed";
    entry.resolve(result);
    this.pending.delete(commandId);
    return true;
  }
}

export const studioBridge = new StudioBridge();
