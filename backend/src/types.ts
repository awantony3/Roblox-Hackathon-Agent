export type AgentState = "planning" | "acting" | "observing" | "evaluating" | "reflecting" | "complete" | "failed";

export interface StudioSnapshot {
  placeId?: number;
  gameId?: number;
  selection?: unknown[];
  hierarchy?: unknown;
  output?: string[];
  capturedAt: string;
}

export interface StudioCommand {
  id: string;
  sessionId: string;
  tool: string;
  input: Record<string, unknown>;
  destructive: boolean;
  status: "pending" | "running" | "complete" | "failed";
  createdAt: string;
}

export interface ToolResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface Reflection {
  outcome: "failed" | "inconclusive";
  evidence: string[];
  rootCauses: string[];
  failedApproaches: string[];
  revisedStrategy: string[];
  retryRecommended: boolean;
}
